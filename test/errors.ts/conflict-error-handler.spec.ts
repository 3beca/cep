import { handleConflictError } from '../../src/errors/conflict-error-handler';
import { ObjectId } from 'mongodb';
import ConflictError from '../../src/errors/conflict-error';

describe('conflict-error-handler', () => {

    describe('handleConflictHandler', () => {

        it('should return the original input error when it is not a Mongo 11000 conflict error', async () => {
            const error = new Error('Oops, an error');
            const errorResult = await handleConflictError(error, async () => Promise.resolve({ _id: new ObjectId() }), {
                itemName: 'rule',
                resources: 'rules'
            });
            expect(errorResult).toBe(error);
        });

        it('should return the original input error when it is a Mongo 11000 conflict error but getConflictItem function returns null', async () => {
            const error = { name: 'MongoError', code: 11000 };
            const errorResult = await handleConflictError(error, async () => Promise.resolve(null), {
                itemName: 'rule',
                resources: 'rules'
            });
            expect(errorResult).toBe(error);
        });

        it('should return a Conflict Error when it is a Mongo 11000 conflict error and getConflictItem function returns the item', async () => {
            const error = { name: 'MongoError', code: 11000 };
            const conflictItemId = new ObjectId();
            const errorResult = await handleConflictError(error, async () => Promise.resolve({ _id: conflictItemId }), {
                itemName: 'rule',
                resources: 'rules'
            });
            expect(errorResult instanceof ConflictError).toBe(true);
            expect((errorResult as ConflictError).message).toBe(`Rule name must be unique and is already taken by rule with id ${conflictItemId}`);
            expect((errorResult as ConflictError).resources).toBe('rules');
            expect((errorResult as ConflictError).id).toBe(conflictItemId.toHexString());
        });
    });
});
