import path from 'path'
import { Message } from 'esbuild'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

export function resolvePath(filePath: string) {
    const [filename, query] = filePath.split('?', 2)
    const dirname = path.dirname(filename)
    return [filename, dirname, query]
}

type ParseErrors = ReturnType<typeof parse>['errors']

const configPath = ts.findConfigFile(
    process.cwd(),
    ts.sys.fileExists,
    'tsconfig.json'
)

const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    process.cwd()
)


export function convertErrors(errors: ParseErrors, filename: string) {
    const convert = (e: ParseErrors[number]): Message => {
        let location: Message['location'] = null
        if ('loc' in e && Object.prototype.hasOwnProperty.call(e, 'loc')) {
            const start = e.loc!.start
            const lineText = e.loc!.source
            location = {
                file: filename,
                namespace: '',
                line: start.line + 1,
                column: start.column,
                length: lineText.length,
                lineText: e.loc!.source,
                suggestion: ''
            }
        }
        return {
            pluginName: 'vue',
            text: e.message,
            location: location,
            notes: [],
            detail: ''
        }
    }
    return errors.map(e => convert(e))
}

export function validateDenpendency() {
    try {
        require.resolve('@vue/compiler-sfc')
    } catch {
        throw new Error('@vue/compiler-sfc has not been installed')
    }
}

function resolveTsAlias(importPath: string, importer: string) {
    const cleanImporter = importer
        .replace(/^vue-script:/, "")
        .split("?")[0]

    const res = ts.resolveModuleName(
        importPath,
        cleanImporter,
        parsed.options,
        ts.sys
    )

    let file = res.resolvedModule?.resolvedFileName
    if (!file) return null

    // не используем .d.ts если есть .ts
    if (file.endsWith(".d.ts")) {
        const tsFile = file.replace(/\.d\.ts$/, ".ts")
        if (ts.sys.fileExists(tsFile)) {
            file = tsFile
        }
    }

    const relative = path.relative(
        path.dirname(cleanImporter),
        file
    )

    const normalized = relative.replace(/\\/g, "/")

    return normalized.startsWith(".")
        ? normalized
        : "./" + normalized
}

export function rewriteTypeImports(code: string, importer: string) {

    return code.replace(
        /import\s+type\s+[^'"]*from\s+['"]([^'"]+)['"]/g,
        (full, importPath) => {

            // пропускаем относительные и абсолютные
            if (
                importPath.startsWith(".") ||
                importPath.startsWith("/")
            ) {
                return full
            }

            const resolved = resolveTsAlias(importPath, importer)
            if (!resolved) return full

            return full.replace(importPath, resolved)
        }
    )
}