import { ObjectId, Db } from 'mongodb';
import { toDto } from '../utils/dto';
import escapeStringRegex from 'escape-string-regexp';
import { Target } from '../models/target';
import InvalidOperationError from '../errors/invalid-operation-error';
import { TemplateEngine } from '../template-engine';
import NotFoundError from '../errors/not-found-error';
import { handleConflictError } from '../errors/conflict-error-handler';

export type TargetsService = {
    list(page: number, pageSize: number, search?: string): Promise<Target[]>;
    getById(id: ObjectId): Promise<Target>;
    getByIds(ids: ObjectId[]): Promise<Target[]>;
    create(target: Pick<Target, 'name' | 'url' | 'headers' | 'body'>): Promise<Target>;
    updateById(id: ObjectId, targetToUpdate: Pick<Target, 'name' | 'url' | 'headers' | 'body'>): Promise<Target>;
    deleteById(id: ObjectId): Promise<void>;
    registerOnBeforeDelete(beforeDelete: (id: ObjectId) => void): void;
}

export function buildTargetsService(db: Db, templateEngine: TemplateEngine): TargetsService {

    const collection = db.collection('targets');
    const beforeDeleteEventHandlers: ((id: ObjectId) => void)[] = [];

    function getContainsRegex(search: string): string {
        return `.*${escapeStringRegex(search)}.*`;
    }

    const unsupportedHeaders = ['content-type', 'content-length'];

    function assertNoUnsupportedHeaders(headers: { [key: string]: string }): void {
        const keys = Object.keys(headers).map(k => k.toLowerCase());
        for (const key of keys) {
            if (unsupportedHeaders.includes(key)) {
                throw new InvalidOperationError(`body/headers/${key} cannot be specified`);
            }
        }
    }

    async function assertBodyTemplateIsValid(body: object | []): Promise<void> {
        try {
            await templateEngine.render(body, {});
        } catch (error) {
            throw new InvalidOperationError(`body/body${error.message}`);
        }
    }

    function findByName(name: string): Promise<{ _id: ObjectId } | null> {
        return collection.findOne({ name }, { projection: { _id: 1 } });
    }

    return {
        async list(page: number, pageSize: number, search?: string): Promise<Target[]> {
            const query = search ? { name: { $regex: getContainsRegex(search), $options: 'i' } } : {};
            const targets = await collection.find(query).skip((page - 1) * pageSize).limit(pageSize).toArray();
            return targets.map(toDto);
        },
        async create(target: Pick<Target, 'name' | 'url' | 'headers' | 'body'>): Promise<Target> {
            const targetToCreate = {
                ...target,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            if (targetToCreate.headers) {
                assertNoUnsupportedHeaders(targetToCreate.headers);
            }
            if (targetToCreate.body) {
                await assertBodyTemplateIsValid(targetToCreate.body);
            }
            try {
                const { insertedId } = await collection.insertOne(targetToCreate);
                return { ...targetToCreate, id: insertedId };
            } catch (error) {
                throw await handleConflictError(error, () => findByName(target.name),
                    { message: 'Target name must be unique and is already taken by target with id [ID]', resources: 'targets' });
            }
        },
        async updateById(id: ObjectId, target: Pick<Target, 'name' | 'url' | 'headers' | 'body'>): Promise<Target> {
            const existingTarget = await this.getById(id);
            if (!existingTarget) {
                throw new NotFoundError(`Target ${id} cannot be found`);
            }
            if (target.headers) {
                assertNoUnsupportedHeaders(target.headers);
            }
            if (target.body) {
                await assertBodyTemplateIsValid(target.body);
            }
            const targetToUpdate = {
                ...target,
                id: undefined,
                updatedAt: new Date(),
                createdAt: existingTarget.createdAt
            };
            try {
                await collection.replaceOne({ _id: id }, targetToUpdate);
                return { ...targetToUpdate, id };
            } catch (error) {
                throw await handleConflictError(error, () => findByName(target.name),
                    { message: 'Target name must be unique and is already taken by target with id [ID]', resources: 'targets' });
            }
        },
        async getById(id: ObjectId): Promise<Target> {
            const target = await collection.findOne({ _id: id });
            return toDto(target);
        },
        async deleteById(id: ObjectId): Promise<void> {
            for (const beforeDelete of beforeDeleteEventHandlers) {
                await beforeDelete(id);
            }
            await collection.deleteOne({ _id: id });
        },
        async getByIds(ids: ObjectId[]): Promise<Target[]> {
            const targets = await collection.find({ _id: { $in: ids }}).toArray();
            return targets.map(toDto);
        },
        registerOnBeforeDelete(beforeDelete: (id: ObjectId) => void): void {
            beforeDeleteEventHandlers.push(beforeDelete);
        }
    };
}
