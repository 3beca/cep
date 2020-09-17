import { Liquid } from 'liquidjs';
import { isArray } from 'util';

export type TemplateEngine = {
    render: (templateObject: object, model: any) => Promise<object>;
}

export function buildTemplateEngine(): TemplateEngine {

    const engine = new Liquid({
        strictFilters: false,
        strictVariables: false
    });

    async function render(templateObject: object, model: any): Promise<object> {
        if (!templateObject || typeof templateObject !== 'object') {
            throw Error('template object must be an object');
        }
        const keys = Object.keys(templateObject);
        const result = {};
        for (const key of keys) {
            result[key] = await renderValue(templateObject[key], model);
        }
        return result;
    }

    async function renderValue(value: object | string | number | [], model: any): Promise<object | string | number | []> {
        if (typeof value === 'string' && value) {
            if (canBeConvertedToFloat(value)) {
                return value;
            }
            const renderedValue = await engine.parseAndRender(value, model);
            const renderedNumber = parseFloat(renderedValue);
            return isNaN(renderedNumber) ? renderedValue : renderedNumber;
        } else if (isArray(value)) {
            return await Promise.all(value.map(v => renderValue(v, model)));
        } else if (value && typeof value === 'object') {
            return await render(value, model);
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
