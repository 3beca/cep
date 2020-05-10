export type Event = {
    id?: string;
    eventTypeId: string;
    eventTypeName: string;
    requestId: string;
    payload: any;
    createdAt: Date;
}
