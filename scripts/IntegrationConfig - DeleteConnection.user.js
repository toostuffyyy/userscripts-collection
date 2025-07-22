// ==UserScript==
// @author       Evgeniy Lykhov
// @name         Integration Config - Delete connection
// @description  Скрипт встраивает в список подключений элементы для удобного выбора и последующего удаления подключений прямо на странице без скриптов.
// @version      18-07-2025
// @match        https://online.sbis.ru/integration_config/?Page=7*
// @match        https://online.sbis.ru/integration_config/?service=extExch&Page=7*
// @match        https://fix-online.sbis.ru/integration_config/?Page=7*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @run-at       document-end
// ==/UserScript==

(async function() {
	// 0. Вставка CSS для фиксированной ширины колонки, центрирования и отступов кнопок
	const style = document.createElement('style');
	style.textContent = `
.controls-DataGridView__th.DataGridView__td__checkBox,
.controls-DataGridView__td.DataGridView__td__checkBox { width: 24px !important; text-align: center !important; min-width: 24px !important; max-width: 24px !important;}
.controls-DataGridView__td.DataGridView__td__checkBox input { width: 50px; height: 17px; cursor: pointer; }
.controls-button {
    display: inline-block;
    outline: 0;
    line-height: normal;
    box-sizing: border-box;
    font-family: Inter;
    font-size: 14px;
    font-weight: 400;
    position: relative;
    box-shadow: none;
    border: 1px solid #587ab0;
    min-width: 48px;
    text-shadow: none;
    -webkit-user-select: none;
    user-select: none;
    color: #000;
    background: #fff;
    height: 24px;
    padding: 0 11px;
    border-radius: 16px;
	white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.controls-button:hover {
    background: #e1ecf6;
}
#sbis-panel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0px 25px;
	gap: 10px;
}
#sbis-panel-left,
#sbis-panel-right {
    display: flex;
	align-items: center;
	justify-content: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
	gap: 10px;
}
#sbis-header-counter {
    font-size: 16px;
	min-width: 110px;
}
`;
	document.head.append(style);

	// Ждём появления целевой таблицы
	function waitFor(selector, timeout = 5000) {
		return new Promise((resolve, reject) => {
			const el = document.querySelector(selector);
			if (el) return resolve(el);
			const obs = new MutationObserver(() => {
				const found = document.querySelector(selector);
				if (found) {
					obs.disconnect();
					resolve(found);
				}
			});
			obs.observe(document.body, { childList: true, subtree: true });
			setTimeout(() => {
				obs.disconnect();
				reject(new Error(`Не найдена таблица ${selector}`));
			}, timeout);
		});
	}

	try {
		const connectionLimitForDeletion = 50;
		const table = await waitFor('.controls-DataGridView__table.ws-sticky-header__table');
		const tbody = table.querySelector('tbody');

		// 1. Вставка колонки для чекбоксов в colgroup
		function insertCol() {
			const cg = table.querySelector('colgroup');
			if (!cg || cg.querySelector('col[data-inserted]')) return;
			const newCol = document.createElement('col');
			newCol.width = '24px';
			newCol.setAttribute('data-inserted', 'true');
			cg.insertBefore(newCol, cg.firstElementChild);
		}
		insertCol();
		// Следим за перерисовкой colgroup
		new MutationObserver(() => insertCol())
			.observe(table.querySelector('colgroup').parentNode, { childList: true });

		// 2. Добавление заголовочного <th> под чекбоксы
		function insertHeaderCell() {
			const theadRow = table.querySelector('thead tr');
			if (!theadRow || theadRow.querySelector('th.DataGridView__td__checkBox')) return;

			const th = document.createElement('th');
			th.className = 'controls-DataGridView__th DataGridView__td__checkBox';
			th.style.textAlign = 'center';
			th.style.width = '24px';

			theadRow.insertBefore(th, theadRow.firstElementChild);
		}
		insertHeaderCell();
		new MutationObserver(() => insertHeaderCell())
			.observe(table, { childList: true, subtree: true });

		// 3. Добавление чекбокса в каждую строку
		function addRowCheckbox(tr) {
			if (tr.querySelector('.DataGridView__td__checkBox input')) return;
			const id = tr.getAttribute('data-id');
			if (!id) return;
			const td = document.createElement('td');
			td.className = 'controls-DataGridView__td DataGridView__td__checkBox';
			const cb = document.createElement('input');
			cb.type = 'checkbox';
			cb.dataset.id = id;
			cb.style.alignContent = 'center';

			cb.addEventListener('click', e => e.stopPropagation());
			td.append(cb);
			tr.insertBefore(td, tr.firstElementChild);
		}
		tbody.querySelectorAll('tr[data-id]').forEach(addRowCheckbox);
		new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n =>
																			n.nodeType === 1 && n.matches('tr[data-id]') && addRowCheckbox(n)
																		   ))).observe(tbody, { childList: true });

		function updateHeaderCounter() {
			const count = tbody.querySelectorAll(
				'td.DataGridView__td__checkBox input:checked'
			).length;
			const counter = document.getElementById('sbis-header-counter');
			if (counter) counter.textContent = `Выбрано: ${count}`;
		}
		tbody.addEventListener('change', e => {
			if (e.target.matches('td.DataGridView__td__checkBox input')) {
				updateHeaderCounter();
			}
		});

		// 4. Панель кнопок над списком, справа от поиска
		function insertPanel() {
			if (document.getElementById('sbis-panel')) return;
			const searchCell = document.querySelector('.controls-Browser__tableCell-search');
			if (!searchCell || !searchCell.parentNode) return;
			const container = searchCell.parentNode;

			const panel = document.createElement('div');
			panel.id = 'sbis-panel';

			const panelLeft = document.createElement('div');
			panelLeft.id = 'sbis-panel-left';
			const panelRight = document.createElement('div');
			panelRight.id = 'sbis-panel-right';

			const btnAll = document.createElement('button');
			btnAll.textContent = 'Выбрать все';
			btnAll.className = 'controls-button';
			btnAll.onclick = () => {
				tbody.querySelectorAll('td.DataGridView__td__checkBox input').forEach(cb => cb.checked = true);
				updateHeaderCounter();
			}

			const btnNone = document.createElement('button');
			btnNone.textContent = 'Снять все';
			btnNone.className = 'controls-button';
			btnNone.onclick = () => {
				tbody.querySelectorAll('td.DataGridView__td__checkBox input').forEach(cb => cb.checked = false);
				updateHeaderCounter();
			}

			const btnDelete = document.createElement('button');
			btnDelete.textContent = 'Удалить выбранные';
			btnDelete.className = 'controls-button';
			btnDelete.onclick = () => {
				const checked = Array.from(tbody.querySelectorAll('td.DataGridView__td__checkBox input:checked'));
				const total = checked.length;
				if (!total) {
					alert('Не выбрано ни одного подключения для удаления.');
					return;
				} else if (total <= connectionLimitForDeletion) {
					if (!confirm(`Вы удаляете ${total} подключений. Продолжить?`)) return;
				} else if (total > connectionLimitForDeletion) {
					if (!confirm(`Будут удалены первые ${connectionLimitForDeletion} из ${total} подключений - остальные останутся.\n` +
								 `Необходимо будет обновить список и повторить удаление оставщихся.\n` +
								 `Продолжить?`)) return;
				}

				const toDelete = checked.slice(0, 50);
				require(['Types/source'], src => {
					const service = new src.SbisService({
						endpoint: {
							address: '/integration_config/service/',
							contract: 'IntegrationConnection'
						}
					});

					toDelete.forEach(cb => {
						service.call('DeleteConnection', { id: cb.dataset.id });
						console.log(`Удалено подключение: ${cb.dataset.id}`);
					});

					tbody.querySelectorAll('td.DataGridView__td__checkBox input').forEach(cb => cb.checked = false);
					updateHeaderCounter();
				});
			};

			const counter = document.createElement('span');
			counter.id = 'sbis-header-counter';
			counter.textContent = 'Выбрано: 0';

			panelLeft.append(counter);
			panelLeft.append(btnAll, btnNone);
			panelRight.append(btnDelete);
			panel.append(panelLeft, panelRight);
			container.insertBefore(panel, searchCell.nextSibling);
		}
		insertPanel();
		new MutationObserver(insertPanel).observe(document.body, { childList: true, subtree: true });

	} catch (error) {
		console.error('[Userscript] Ошибка:', error);
	}
})();