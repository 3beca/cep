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

        it('should return template object replacing with empty string when variable does not exist in the model', async () => {
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

        it('should return template object skip invalid filters', async () => {
            const result = await templateEngine.render({
                title: 'My {{ title | invalidFilter | capitalize }}'
            }, { title: 'test' });

            expect(result).toStrictEqual({
                title: 'My Test',
            });
        });

        it('should return template object applying valid filters', async () => {
            const result = await templateEngine.render({
                title: 'My {{ title | upcase }}'
            }, { title: 'test' });

            expect(result).toStrictEqual({
                title: 'My TEST',
            });
        });
    });
});
