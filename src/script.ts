import { compileScript } from '@vue/compiler-sfc'
import { getDesCache, getId } from './cache'
import { PartialMessage } from 'esbuild'
import { Options } from './index'
import { getTemplateOptions } from './template'
import convert from 'convert-source-map'
import ts from 'typescript'

export function resolveScript(
    filename: string,
    scriptOptions: Options['scriptOptions'] = {},
    templateOptions: Options['templateOptions'] = {},
    isProd: boolean,
    sourcemap: boolean
) {
    const descriptor = getDesCache(filename)

    const error: PartialMessage[] = []
    const { script, scriptSetup } = descriptor
    const isTs = (script && script.lang === 'ts') || (scriptSetup && scriptSetup.lang === 'ts')

    let code = 'export default {}'
    if (!descriptor.script && !descriptor.scriptSetup) {
        return {
            code
        }
    }

    const scopeId = getId(filename)
    try {
        const res = compileScript(descriptor, {
            id: scopeId,
            filename: filename,
            sourceMap: sourcemap,
            inlineTemplate: true,
            refTransform: true,
            refSugar: scriptOptions.refSugar,
            templateOptions: descriptor.template ? getTemplateOptions(descriptor, templateOptions, isProd) : {},
            isProd,
            fs: ts.sys,
            babelParserPlugins: scriptOptions.babelParserPlugins,
        })
        code = res.content
        if (res.map) {
            code += convert.fromObject(res.map).toComment()
        }
    } catch (e: any) {
        error.push({
            text: e.message
        })
    }

    return {
        code,
        error,
        isTs
    }
}
