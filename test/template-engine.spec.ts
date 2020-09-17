import { buildTemplateEngine } from '../src/template-engine';

describe('template-engine', () => {

    let templateEngine;

    beforeEach(() => {
        templateEngine = buildTemplateEngine();
    });

    describe('render', () => {
        it('should throw an error if template object is not an object', async () => {
            expect.assertions(1);
            try {
                await templateEngine.render(null, {});
            } catch (error) {
                expect(error.message).toBe('template object must be an object');
            }
        });

        it('should return template object with no modification when no template string', async () => {
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

        it('should return template object with variable resolved when template string', async () => {
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

        it('should return template object honoring undefined and null values', async () => {
            const result = await templateEngine.render({
                title: 'My {{title}}',
                value: null,
                value2: undefined
            }, { title: 1, description: 'cat', test: 'composed' });

            expect(result).toStrictEqual({
                title: 'My 1',
                value: null,
                value2: undefined
            });
        });

        it('should return template object converting to number string values that after rendering are numbers', async () => {
            const result = await templateEngine.render({
                title: 'My {{title}}',
                value: '{{value}}',
                value2: '49',
                value3: 'the value is {{value}}'
            }, { title: 'test', value: 4.99 });

            expect(result).toStrictEqual({
                title: 'My test',
                value: 4.99,
                value2: '49',
                value3: 'the value is 4.99'
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
                expect(error.message).toBe('/title partials and layouts are not supported, line:1, col:4');
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
                expect(error.message).toBe('/title/0/value partials and layouts are not supported, line:1, col:4');
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
                expect(error.message).toBe('/title/0/value tag "bla" not found, line:1, col:4');
            }
        });
    });
});
