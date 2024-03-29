import { buildTemplateEngine } from '../src/template-engine';

describe('template-engine', () => {

    let templateEngine;

    beforeEach(() => {
        templateEngine = buildTemplateEngine();
    });

    describe('render', () => {
        it('should throw an error if template is null', async () => {
            expect.assertions(1);
            try {
                await templateEngine.render(null, {});
            } catch (error) {
                expect((error as Error).message).toBe('template must be an object or an array');
            }
        });

        it('should throw an error if template is not an object or an array', async () => {
            expect.assertions(1);
            try {
                await templateEngine.render(1 as unknown, {});
            } catch (error) {
                expect((error as Error).message).toBe('template must be an object or an array');
            }
        });

        it('should return rendered template with no modification when no template string', async () => {
            const result = await templateEngine.render({
                title: 'My title',
                value: 5,
                description: 'My description',
                composed: {
                    value: 1,
                    name: 'test'
                }
            }, {});

            expect(result).toStrictEqual({
                title: 'My title',
                value: 5,
                description: 'My description',
                composed: {
                    value: 1,
                    name: 'test'
                }
            });
        });

        it('should return rendered template with variable resolved when template string', async () => {
            const result = await templateEngine.render({
                title: 'My {{title}}',
                value: 5,
                description: 'My {{description}}',
                array: ['{{title}}', {
                    composedInArray: {
                        test: '{{test}}',
                        test2: 1,
                        test3: 'no template'
                    }
                }, 'hey'],
                composed: {
                    value: 1,
                    name: '{{test}}'
                }
            }, { title: 1, description: 'cat', test: 'composed' });

            expect(result).toStrictEqual({
                title: 'My 1',
                value: 5,
                description: 'My cat',
                array: [1, {
                    composedInArray: {
                        test: 'composed',
                        test2: 1,
                        test3: 'no template'
                    }
                }, 'hey'],
                composed: {
                    value: 1,
                    name: 'composed'
                }
            });
        });

        it('should return rendered template honoring undefined and null values', async () => {
            const result = await templateEngine.render({
                title: 'My {{title}}',
                value: null,
                value2: undefined,
                value3: [null, undefined, 0]
            }, { title: 1, description: 'cat', test: 'composed' });

            expect(result).toStrictEqual({
                title: 'My 1',
                value: null,
                value2: undefined,
                value3: [null, undefined, 0]
            });
        });

        it('should return rendered template converting to number string values that after rendering are numbers', async () => {
            const result = await templateEngine.render({
                title: 'My {{title}}',
                value: '{{value}}',
                value2: '49',
                value3: 'the value is {{value}}',
                value4: '{{objectId}}'
            }, { title: 'test', value: 4.99, objectId: '5f64c94f9e1055a117699589' });

            expect(result).toStrictEqual({
                title: 'My test',
                value: 4.99,
                value2: '49',
                value3: 'the value is 4.99',
                value4: '5f64c94f9e1055a117699589'
            });
        });

        it('should throw an error if some template makes use of include', async () => {
            expect.assertions(1);
            try {
                await templateEngine.render({
                    title: 'My {% include "package.json" %}',
                    value: '{{value}}',
                    value2: '49',
                    value3: 'the value is {{value}}'
                }, { title: 'test', value: 4.99 });
            } catch (error) {
                expect((error as Error).message).toBe('/title partials and layouts are not supported, line:1, col:4');
            }
        });

        it('should throw an error if some template makes use of render', async () => {
            expect.assertions(1);
            try {
                await templateEngine.render({
                    title: [{ value: 'My {% render "package.json" %}' }],
                    value: '{{value}}',
                    value2: '49',
                    value3: 'the value is {{value}}'
                }, { title: 'test', value: 4.99 });
            } catch (error) {
                expect((error as Error).message).toBe('/title/0/value partials and layouts are not supported, line:1, col:4');
            }
        });

        it('should throw an error if some template makes use of an invalid tag', async () => {
            expect.assertions(1);
            try {
                await templateEngine.render({
                    title: [{ value: 'My {% bla %}' }],
                    value: '{{value}}',
                    value2: '49',
                    value3: 'the value is {{value}}'
                }, { title: 'test', value: 4.99 });
            } catch (error) {
                expect((error as Error).message).toBe('/title/0/value tag "bla" not found, line:1, col:4');
            }
        });

        it('should throw an error if some template has invalid syntax', async () => {
            expect.assertions(1);
            try {
                await templateEngine.render({
                    title: [{ value: 'My {{a}}' }],
                    value: '{{value',
                    value2: '49',
                    value3: 'the value is {{value}}'
                }, { title: 'test', value: 4.99 });
            } catch (error) {
                expect((error as Error).message).toBe('/value output "{{value" not closed, line:1, col:1');
            }
        });

        it('should return rendered template replacing with empty string when variable does not exist in the model', async () => {
            const result = await templateEngine.render({
                title: 'My {{a}}',
                value: '{{a.b.c}}',
                value2: '49',
                value3: 'the value is {{d.i}}'
            }, { title: 'test', value: 4.99 });

            expect(result).toStrictEqual({
                title: 'My ',
                value: '',
                value2: '49',
                value3: 'the value is '
            });
        });

        it('should return rendered template skip invalid filters', async () => {
            const result = await templateEngine.render({
                title: 'My {{ title | invalidFilter | capitalize }}'
            }, { title: 'test' });

            expect(result).toStrictEqual({
                title: 'My Test',
            });
        });

        it('should return rendered template applying valid filters', async () => {
            const result = await templateEngine.render({
                title: 'My {{ title | upcase }}'
            }, { title: 'test' });

            expect(result).toStrictEqual({
                title: 'My TEST',
            });
        });

        it('should return rendered template applying if logic', async () => {
            const result = await templateEngine.render({
                title: 'Value is {% if value > 5 %}HIGH{% endif %}'
            }, { value: 7 });

            expect(result).toStrictEqual({
                title: 'Value is HIGH',
            });
        });

        it('should return a rendered template when is an array', async () => {
            const result = await templateEngine.render([{
                title: 'Value is {% if value > 5 %}HIGH{% endif %}'
            }], { value: 7 });

            expect(result).toStrictEqual([{
                title: 'Value is HIGH',
            }]);
        });
    });
});
