import { PluginSettingTab, Setting } from 'obsidian';
import MyPlugin from './main';


export interface DevUtilsSettings {
	obsidianName: string;
	pluginName: string;
	reloadPluginId: string;
}

export const DEFAULT_SETTINGS: DevUtilsSettings = {
	obsidianName: 'obs',
	pluginName: 'devUtils',
	reloadPluginId: '',
}

export class DevUtilsSettingTab extends PluginSettingTab {
	constructor(public plugin: MyPlugin) {
		super(plugin.app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Obsidian module name')
			.setDesc('Obsidian API is exposed as a global variable with this name.')
			.addText(text => text
				.setValue(this.plugin.settings.obsidianName)
				.onChange(async (value) => {
					this.plugin.settings.obsidianName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Plugin variable name')
			.setDesc('The plugin object is available with this name.')
			.addText(text => text
				.setValue(this.plugin.settings.pluginName)
				.onChange(async (value) => {
					this.plugin.settings.pluginName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Plugin ID to reload')
			.addText((text) => {
				text.setValue(this.plugin.settings.reloadPluginId)
					.onChange(async (value) => {
						this.plugin.settings.reloadPluginId = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
