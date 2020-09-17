import { Liquid } from 'liquidjs';
import { isArray } from 'util';
import { FS } from 'liquidjs/dist/fs/fs';

export type TemplateEngine = {
    render: (templateObject: object, model: any) => Promise<object>;
}

export function buildTemplateEngine(): TemplateEngine {

    const engine = new Liquid({
        strictFilters: false,
        strictVariables: false,
        fs: {
            exists: () => Promise.resolve(false),
            resolve: () => ''
        } as unknown as FS
    });

    async function render(templateObject: object, model: any, baseKey: string = '/'): Promise<object> {
        if (!templateObject || typeof templateObject !== 'object') {
            throw Error('template object must be an object');
        }
        const keys = Object.keys(templateObject);
        const result = {};
        for (const key of keys) {
            result[key] = await renderValue(templateObject[key], model, baseKey + key);
        }
        return result;
    }

    async function renderValue(value: object | string | number | [], model: any, baseKey: string): Promise<object | string | number | []> {
        if (typeof value === 'string' && value) {
            if (canBeConvertedToFloat(value)) {
                return value;
            }
            try {
                const renderedValue = await engine.parseAndRender(value, model);
                const renderedNumber = parseFloat(renderedValue);
                return isNaN(renderedNumber) ? renderedValue : renderedNumber;
            } catch (error) {
                const { message } = error;
                if (message.includes('ENOENT')) {
                    throw Error(`${baseKey} partials and layouts are not supported${message.substring(message.indexOf(', line:'))}`);
                }
                throw Error(`${baseKey} ${message}`);
            }
        } else if (isArray(value)) {
            return await Promise.all(value.map((v, i) => renderValue(v, model, `${baseKey}/${i}/`)));
        } else if (value && typeof value === 'object') {
            return await render(value, model, baseKey);
        }
        return value;
    }

    function canBeConvertedToFloat(value: string): boolean {
        const number = parseFloat(value);
        return !isNaN(number);
    }

    return {
        render
    };
}
