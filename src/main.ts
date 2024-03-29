import { ViewUpdate } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { CachedMetadata, Editor, FileSystemAdapter, MarkdownView, Modifier, Platform, Plugin, TFile, Notice } from 'obsidian';
import * as obsidian from 'obsidian';
import { DEFAULT_SETTINGS, DevUtilsSettings, DevUtilsSettingTab } from './settings';
import { syntaxTree } from '@codemirror/language';
import { Tree, SyntaxNodeRef } from '@lezer/common';


export default class DevUtilsPlugin extends Plugin {
	settings: DevUtilsSettings;
	editorExtensions: Extension[] = [];

	async onload() {
		await this.loadSettings();
		await this.saveSettings();
		this.addSettingTab(new DevUtilsSettingTab(this));
		this.registerEditorExtension(this.editorExtensions);
		this.registerCommands();

		this.app.workspace.onLayoutReady(() => this.registerUtilities());
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	registerCommands() {
		this.addCommand({
			id: 'reload-plugin',
			name: 'Reload plugin',
			callback: async () => {
				// @ts-ignore
				await this.app.plugins.disablePlugin(this.settings.reloadPluginId);
				// @ts-ignore
				await this.app.plugins.enablePlugin(this.settings.reloadPluginId);
			}
		});

		this.addCommand({
			id: 'copy-absolute-path',
			name: `Copy absolute path (press ${getModifierNameInPlatform('Mod')} to escape spaces)`,
			checkCallback: (checking) => {
				const adapter = this.app.vault.adapter;
				if (!(adapter instanceof FileSystemAdapter)) return false;
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) {
					const isModPressed = this.app.lastEvent ? obsidian.Keymap.isModifier(this.app.lastEvent, 'Mod') : false;
					const absPath = adapter.getFullPath(file.path);
					navigator.clipboard.writeText(isModPressed ? absPath.replace(/ /g, '\\ ') : absPath);
					new Notice('Path copied to the clipboard.');
				}
				return true;
			}
		});
	}

	registerUtilities() {
		const { app } = this;
		const utils = {
			getMarkdownView(): MarkdownView | null {
				return app.workspace.getActiveViewOfType(MarkdownView);
			},
			getFile(name?: string): TFile | null {
				const activeFile = app.workspace.getActiveFile();
				if (name === undefined) return activeFile;
				return app.metadataCache.getFirstLinkpathDest(name, activeFile?.path ?? '');
			},
			getPath(): string | null {
				return app.workspace.getActiveFile()?.path ?? null;
			},
			getEditor(): Editor | null {
				return app.workspace.activeEditor?.editor ?? null
			},
			getCache(name?: string): CachedMetadata | null {
				const file = utils.getFile(name);
				if (!file) return null;
				return app.metadataCache.getFileCache(file);
			},
			getAbsolutePath(name?: string): string | null {
				if (app.vault.adapter instanceof FileSystemAdapter) {
					const file = utils.getFile(name);
					if (!file) return null;
					return app.vault.adapter.getFullPath(file.path);
				}
				return null;
			},
			getEditorView(): EditorView | null {
				// @ts-ignore
				return utils.getEditor()?.cm ?? null;
			},
			getEditorState(): EditorState | null {
				// @ts-ignore
				return utils.getEditorView()?.state ?? null;
			},
			syntaxTree(state?: EditorState): Tree | null {
				state = state ?? utils.getEditorState() ?? undefined;
				if (!state) return null;
				return syntaxTree(state);
			},
			printNode(node: SyntaxNodeRef, state?: EditorState) {
				state = state ?? utils.getEditorState() ?? undefined;
				if (!state) return null;
				const lineStart = state.doc.lineAt(node.from);
				const lineEnd = state.doc.lineAt(node.to);
				console.log(`l${lineStart.number}/c${node.from-lineStart.from}-l${lineEnd.number}/c${node.to-lineEnd.from} (${node.from}-${node.to}): "${state.sliceDoc(node.from, node.to)}" (${node.name})`);
			},
			printNodes(state?: EditorState) {
				const tree = utils.syntaxTree(state);
				if (!tree) return null;
				tree.iterate({
					enter(node) {
						utils.printNode(node, state);
					}
				})
			},
			searchCommand(query: string) {
				// @ts-ignore
				return Object.values(app.commands.commands).filter(cmd => cmd.name.toLowerCase().contains(query.toLowerCase()))
			},
			searchIcon(query: string) {
				// @ts-ignore
				return obsidian.getIconIds().filter(id => id.toLowerCase().contains(query.toLowerCase()))
			}
		};
		for (const [name, fn] of Object.entries(utils)) {
			this.registerToWindow(name, fn);
		}
		this.registerToWindow(this.settings.obsidianName, obsidian);
		this.registerToWindow(this.settings.pluginName, this);
	}

	registerToWindow(name: string, obj: any) {
		// @ts-ignore
		(window[name] = obj) && this.register(() => delete window[name]);
	}

	addUpdateListener(callback: (update: ViewUpdate) => void) {
		this.registerEditorExtension(EditorView.updateListener.of(callback));
	}

	clearUpdateListeners() {
		this.editorExtensions.length = 0;
		this.app.workspace.updateOptions();
	}

	setUpdateListener(callback: (update: ViewUpdate) => void) {
		this.clearUpdateListeners();
		this.addUpdateListener(callback);
	}
}

function getModifierNameInPlatform(mod: Modifier): string {
    if (mod === 'Mod') {
        return Platform.isMacOS || Platform.isIosApp ? 'Command' : 'Ctrl';
    }
    if (mod === 'Shift') {
        return 'Shift';
    }
    if (mod === 'Alt') {
        return Platform.isMacOS || Platform.isIosApp ? 'Option' : 'Alt';
    }
    if (mod === 'Meta') {
        return Platform.isMacOS || Platform.isIosApp ? 'Command' : Platform.isWin ? 'Win' : 'Meta';
    }
    return 'Ctrl';
}
