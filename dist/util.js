"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewriteTypeImports = exports.validateDenpendency = exports.convertErrors = exports.resolvePath = void 0;
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
function resolvePath(filePath) {
    const [filename, query] = filePath.split('?', 2);
    const dirname = path_1.default.dirname(filename);
    return [filename, dirname, query];
}
exports.resolvePath = resolvePath;
const configPath = typescript_1.default.findConfigFile(process.cwd(), typescript_1.default.sys.fileExists, 'tsconfig.json');
const configFile = typescript_1.default.readConfigFile(configPath, typescript_1.default.sys.readFile);
const parsed = typescript_1.default.parseJsonConfigFileContent(configFile.config, typescript_1.default.sys, process.cwd());
function convertErrors(errors, filename) {
    const convert = (e) => {
        let location = null;
        if ('loc' in e && Object.prototype.hasOwnProperty.call(e, 'loc')) {
            const start = e.loc.start;
            const lineText = e.loc.source;
            location = {
                file: filename,
                namespace: '',
                line: start.line + 1,
                column: start.column,
                length: lineText.length,
                lineText: e.loc.source,
                suggestion: ''
            };
        }
        return {
            pluginName: 'vue',
            text: e.message,
            location: location,
            notes: [],
            detail: ''
        };
    };
    return errors.map(e => convert(e));
}
exports.convertErrors = convertErrors;
function validateDenpendency() {
    try {
        require.resolve('@vue/compiler-sfc');
    }
    catch {
        throw new Error('@vue/compiler-sfc has not been installed');
    }
}
exports.validateDenpendency = validateDenpendency;
function resolveTsAlias(importPath, importer) {
    const cleanImporter = importer
        .replace(/^vue-script:/, "")
        .split("?")[0];
    const res = typescript_1.default.resolveModuleName(importPath, cleanImporter, parsed.options, typescript_1.default.sys);
    let file = res.resolvedModule?.resolvedFileName;
    if (!file)
        return null;
    // не используем .d.ts если есть .ts
    if (file.endsWith(".d.ts")) {
        const tsFile = file.replace(/\.d\.ts$/, ".ts");
        if (typescript_1.default.sys.fileExists(tsFile)) {
            file = tsFile;
        }
    }
    const relative = path_1.default.relative(path_1.default.dirname(cleanImporter), file);
    const normalized = relative.replace(/\\/g, "/");
    return normalized.startsWith(".")
        ? normalized
        : "./" + normalized;
}
function rewriteTypeImports(code, importer) {
    return code.replace(/import\s+type\s+[^'"]*from\s+['"]([^'"]+)['"]/g, (full, importPath) => {
        // пропускаем относительные и абсолютные
        if (importPath.startsWith(".") ||
            importPath.startsWith("/")) {
            return full;
        }
        const resolved = resolveTsAlias(importPath, importer);
        if (!resolved)
            return full;
        return full.replace(importPath, resolved);
    });
}
exports.rewriteTypeImports = rewriteTypeImports;
