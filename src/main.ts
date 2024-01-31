import { WidgetType } from '@codemirror/view';
import { Decoration } from '@codemirror/view';
import { DecorationSet } from '@codemirror/view';
import { PluginValue } from '@codemirror/view';
import { ViewPlugin } from '@codemirror/view';
import { ViewUpdate } from '@codemirror/view';
import { EditorView } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { CachedMetadata, Editor, FileSystemAdapter, MarkdownView, Plugin, TFile } from 'obsidian';
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
