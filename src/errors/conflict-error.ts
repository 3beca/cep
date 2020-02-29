export default class ConflictError extends Error {
    public id: string;
    constructor(message, id) {
        super(message);
        this.id = id;
    }
}
