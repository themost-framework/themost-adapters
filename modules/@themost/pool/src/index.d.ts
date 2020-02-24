/**
 * MOST Web Framework 2.0 Codename Blueshift
 * Copyright (c) 2014-2020, Kyriakos Barbounakis k.barbounakis@gmail.com
 *                     Anthi Oikonomou anthioikonomou@gmail.com
 *
 * Use of this source code is governed by an BSD-3-Clause license that can be
 * found in the LICENSE file at https://themost.io/license
 */

declare type GenericPoolAdapterCallback = (err?: Error) => void;

export declare interface GenericPoolOptions {
    adapter: string;
    max?: number;
    min?: number;
    maxWaitingClients?: number;
    testOnBorrow?: boolean;
    acquireTimeoutMillis?: number;
    fifo?: boolean;
    priorityRange?: number;
    autostart?: boolean;
    evictionRunIntervalMillis?: number;
    softIdleTimeoutMillis?: number;
    idleTimeoutMillis?: number;
}

export declare interface GenericPoolAdapterOptions {
    name: string;
    invariantName: string;
    default?: boolean;
    options: GenericPoolOptions;
}

declare interface ApplicationDataConfiguration {
    adapters: Array<any>;
    getAdapterType(name: string): any;
}



export declare class GenericPoolAdapter {
    constructor(options: GenericPoolAdapterOptions);
    open(callback: GenericPoolAdapterCallback): void;
    close(callback: GenericPoolAdapterCallback): void;
    createView(name: string, query: any, callback: GenericPoolAdapterCallback): void;
    executeInTransaction(func: any, callback: GenericPoolAdapterCallback): void;
    migrate(obj: any, callback: GenericPoolAdapterCallback): void;
    selectIdentity(entity: string, attribute: string, callback: (err: Error, value: any) => void): void;
    execute(query: any, values: any, callback: (err: Error, value: any) => void): void;
}



export declare function createInstance(options: any): GenericPoolAdapter;
