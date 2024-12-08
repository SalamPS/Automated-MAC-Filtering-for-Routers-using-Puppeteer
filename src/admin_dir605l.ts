import { Browser } from "puppeteer";
import { ADMIN_PASS, click, Data, PRIVILEGED, puppet, sendLog } from "./utils";

const added = []
const deleted = []

export const admin_dir605l = async (ip:string, browser: Browser, fetched: Data[]) => {
	sendLog('Starting...');
	const page = await browser.newPage();
	await page.goto(ip);
	
	// Login to the router
	await puppet(page, async () => {
		const passwordInput = await page.$('#login_pass');
		if (passwordInput) {
			await passwordInput.type(ADMIN_PASS || '');
		} else {
			throw new Error('Password input field not found');
		}

		click(page, '#Login');
	}, 'Logging in...');
	
	// Get into admin menu
	await puppet(page, async () => {
		click(page, 'input[name="exit"]')
	}, 'Getting into admin menu...');
	
	// Get into advanced menu
	await puppet(page, async () => {
		click(page, '#Advanced_topnav')
	}, 'Getting into advanced menu...');
	
	// Get into MAC Filtering menu
	await puppet(page, async () => {
		const advancedSubNav = await page.$('#Advanced_subnav');
		if (advancedSubNav) {
			click(advancedSubNav, 'li:nth-child(3) a');
		} else {
			throw new Error('Advanced subnav not found');
		}
	}, 'Getting into MAC Filtering menu...');
	
	// Manipulating MAC filtering list
	await puppet(page, async () => {
		const listed: Data[] = []
		const empty: Data[] = []
		const table = await page.$('.formlisting');
		if (table) {
			const rows = await table.$$('tr');
			for (let index = 0; index < rows.length; index++) {
				if (index > 0) {
					const data = {
						mac: '',
						name: '',
						index: 0
					}
					const row = rows[index];
					const cells = await row.$$('td');
					const input_mac = await cells[1].$(`input[name="mac_addr_${index-1}"]`);
					const input_name = await cells[4].$(`input[name="mac_hostname_${index-1}"]`);

					if (input_mac && input_name) {
						const macVal = await input_mac.evaluate((el: HTMLInputElement) => el.value);
						data.mac = macVal;

						const nameVal = await input_name.evaluate((el: HTMLInputElement) => el.value);
						data.name = nameVal;

						data.index = index;
					}

					if (data.mac && data.name) {
						if (!PRIVILEGED.includes(data.mac)) {
							console.log(`${data.mac} of ${data.name}`);
							listed.push(data);
						}
						else {
							console.log(`${data.mac} of ${data.name} is privileged`);
						}
					}
					else {
						empty.push({
							...data, index
						});
						console.log('Empty Data on row', index);
					}
				}
			}
				
			const toAdd: Data[] = fetched.map(data => listed.find(l => l.mac === data.mac) ? null : data).filter((d): d is Data => d !== null);
			const toDel: Data[] = listed.filter(data => !fetched.find(f => f.mac === data.mac));

			console.log("Adding: " + toAdd.length + "...");
			for (const user of toAdd) {
				const row = empty.shift();
				if (row && row.index) {
					const input_mac = await page.$(`input[name="mac_addr_${row.index-1}"]`);
					const input_name = await page.$(`input[name="mac_hostname_${row.index-1}"]`);
					if (input_mac && input_name) {
						try {
							await input_mac.type(user.mac);
							await input_name.type(user.name);
						} catch (err) {
							console.error(`Error typing for user ${user.mac}:`, err);
						}
					}
					added.push(user);
					click(page, `#entry_enable_${row.index-1}`);
				}
			}

			console.log("Deleting: " + toDel.length + "...");
			for (const user of toDel) {
				if (user.index) click(page, `#entry_enable_${user.index-1}`);
			}

			const updated = added.length + deleted.length
			if (updated) {
				console.log("Saving: " + updated + " changes...");
				click(page, '#SaveSettings');
			}
		} else {
			throw new Error('Table with class formlisting not found');
		}
	}, 'Updating MAC filtering list...');

	const updated = added.length + deleted.length

	if (updated) {
		await puppet(page, async () => {
			click(page, '#RestartNow');
		}, 'Restarting router...');

		await puppet(page, async () => {
			console.log('Added:', added.length, 'user(s)');
			console.log('Deleted:', deleted.length, 'user(s)');
		}, 'Action succesful on 192.168.0.1');
	}
	else console.log('No changes needed. Exiting...');
	
	// Take a screenshot of the page
	// await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	// await page.screenshot({ path: './dev/192.168.0.1-debug.png' });
	await page.close();
}