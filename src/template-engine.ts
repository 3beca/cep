import { Liquid } from 'liquidjs';
import { isArray } from 'util';
import { FS } from 'liquidjs/dist/fs/fs';

export type TemplateEngine = {
    render: (template: object | [], model: any) => Promise<object | []>;
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

    function render(template: object | [], model: any) : Promise<object | []> {
        if (!template || (typeof template !== 'object' && !isArray(template))) {
            throw Error('template must be an object or an array');
        }
        if (isArray(template)) {
            return renderArray(template, model, '/');
        }
        return renderObject(template, model);
    }

    async function renderObject(object: object, model: any, baseKey: string = '/'): Promise<object> {
        const keys = Object.keys(object);
        const result = {};
        for (const key of keys) {
            result[key] = await renderValue(object[key], model, baseKey + key);
        }
        return result;
    }

    async function renderValue(value: object | string | number | [], model: any, baseKey: string): Promise<object | string | number | []> {
        if (typeof value === 'string' && value) {
            return renderString(value, model, baseKey);
        } else if (isArray(value)) {
            return await renderArray(value, model, baseKey);
        } else if (value && typeof value === 'object') {
            return await renderObject(value, model, baseKey);
        }
        return value;
    }

    async function renderString(value: string, model, baseKey: string): Promise<string | number> {
        if (canBeConvertedToFloat(value)) {
            return value;
        }
        try {
            const renderedValue = await engine.parseAndRender(value, model);
            return canBeConvertedToFloat(renderedValue) ? parseFloat(renderedValue) : renderedValue;
        } catch (error) {
            const { message } = error as Error;
            if (message.includes('ENOENT')) {
                throw Error(`${baseKey} partials and layouts are not supported${message.substring(message.indexOf(', line:'))}`);
            }
            throw Error(`${baseKey} ${message}`);
        }
    }

    function renderArray(values: [], model, baseKey: string): Promise<(string | number | object | [])[]> {
        return Promise.all(values.map((value, i) => renderValue(value, model, `${baseKey}/${i}/`)));
    }

    function canBeConvertedToFloat(value: string): boolean {
        const number = parseFloat(value);
        return !isNaN(number) && number.toString() === value;
    }

    return {
        render
    };
}
