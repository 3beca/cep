export default class ConflictError extends Error {
    public id: string;
    public resources: string
    constructor(message: string, id: string, resources: string) {
        super(message);
        this.id = id;
        this.resources = resources;
    }
}
