// tslint:disable:ban-types

import {
    AssociationOptions,
    BelongsToManyOptions,
    BelongsToOptions,
    DataTypes,
    HasManyOptions,
    HasOneOptions,
    IndexesOptions,
    Model,
    ModelAttributeColumnOptions,
    ModelStatic,
    ModelOptions,
    ThroughOptions
} from 'sequelize';
import { Sequelize } from 'sequelize';

export interface IIndexOptions {
    /**
     * name for the index
     * if creating a compound index name is required and must match name for the index on other column
     */
    name?: string;
    unique?: boolean;
}

export function Entity(name?: string | ModelOptions<any>, options?: ModelOptions<any>) {
    return (target: Function) => {
        let meta = getMeta(target.prototype);

        if (typeof name === 'string') {
            meta.name = name;
        } else {
            meta.name = target.name;

            if (options == null && name != null && typeof name === 'object') {
                options = Object.assign({}, name, meta.options);
            }
        }

        meta.options = Object.assign({}, options, meta.options);

        // we will default to not having timestamp columns
        if (meta.options.createdAt == null) {
            meta.options.createdAt = false;
        }

        if (meta.options.updatedAt == null) {
            meta.options.updatedAt = false;
        }
    };
}

export function Column(attribute: ModelAttributeColumnOptions) {
    return (target: any, key: string) => {
        let meta = getMeta(target);
        meta.fields[key] = attribute;
    };
}

export function CreatedDateColumn() {
    return (target: any, key: string) => {
        let meta = getMeta(target);
        meta.created = key;
    };
}

export function UpdatedDateColumn() {
    return (target: any, key: string) => {
        let meta = getMeta(target);
        meta.updated = key;
    };
}

export function PrimaryGeneratedColumn() {
    return (target: any, key: string) => {
        let meta = getMeta(target);
        meta.fields[key] = {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
        };
    };
}

export function HasOne(typeFunction: () => Function, options?: HasOneOptions) {
    return (target: any, key: string) => {
        let meta = getMeta(target);

        if (options == null) {
            options = {};
        }

        options.as = key;

        meta.associations[key] = {
            method: AssociationMethods.HAS_ONE,
            target: typeFunction,
            association: options
        };
    };
}

export function HasMany(typeFunction: () => Function, options?: HasManyOptions) {
    return (target: any, key: string) => {
        let meta = getMeta(target);

        if (options == null) {
            options = {};
        }

        options.as = key;

        meta.associations[key] = {
            method: AssociationMethods.HAS_MANY,
            target: typeFunction,
            association: options
        };
    };
}

export function BelongsTo(typeFunction: () => Function, options?: BelongsToOptions) {
    return (target: any, key: string) => {
        let meta = getMeta(target);

        if (options == null) {
            options = {};
        }

        options.as = key;

        meta.associations[key] = {
            method: AssociationMethods.BELONGS_TO,
            target: typeFunction,
            association: options
        };
    };
}

export function ManyToMany(typeFunction: () => Function, options: BelongsToManyOptions) {
    return (target: any, key: string) => {
        let meta = getMeta(target);

        if (options == null) {
            options = {} as BelongsToManyOptions;
        }

        if (options.through == null) {
            throw new Error('through property is required for belongs to many association');
        }

        options.as = key;

        meta.associations[key] = {
            method: AssociationMethods.BELONGS_TO_MANY,
            target: typeFunction,
            association: options
        };
    };
}

export function Index(options?: IIndexOptions) {
    return (target: any, key: string) => {
        let meta = getMeta(target);
        if (meta.options.indexes == null) {
            meta.options.indexes = [];
        }

        if (options == null) {
            options = {} as IIndexOptions;
        }

        let index: IndexesOptions = null;
        if (options.name != null) {
            index = meta.options.indexes.find((i) => {
                return i.name === options.name;
            });
        }

        if (index == null) {
            index = {
                name: options.name,
                unique: options.unique,
                fields: [key]
            };
            (meta.options.indexes as any).push(index);
        } else {
            index.fields.push(key);
        }

        clean(index);
    };
}

export function registerEntities(sequelize: Sequelize, entities: Function[]): {
    [key: string]: ModelStatic<Model>;
} {
    // define the attributes
    for (let entity of entities) {
        // initially we need to merge base entities with their children
        mergeEntity(entity);
        let e = Object.create(entity.prototype);
        let meta = getMeta(e);

        // in case entity did not come from inheritance structure
        meta.options.updatedAt = meta.updated || meta.options.updatedAt;
        meta.options.createdAt = meta.created || meta.options.createdAt;

        sequelize.define(meta.name, meta.fields, meta.options);
    }

    // define the associations
    for (let entity of entities) {
        let e = Object.create(entity.prototype);
        let meta = getMeta(e);

        if (meta.associations != null) {
            let model = sequelize.models[entity.name];
            if (model != null) {
                for (let assnName of Object.keys(meta.associations)) {
                    let entityAssociation = meta.associations[assnName];
                    let targetName = entityAssociation.target().name;
                    // add the include association to the model
                    (model as any)[assnName] = (model as any)[entityAssociation.method](sequelize.models[targetName], entityAssociation.association);
                }
            }
        }
    }

    return sequelize.models;
}

function mergeEntity(entity: Function) {
    let keys: string[] = getEntityKeys(entity);
    // remove first key since it is this entity
    keys.splice(0, 1);
    let e = Object.create(entity.prototype);
    let mainEntityMeta = getMeta(e);

    // now lets add inherited entity items
    for (let key of keys) {
        let inheritedMeta = getEntityMeta(e, key);
        if (inheritedMeta != null) {
            // merge fields
            for (let fKey of Object.keys(inheritedMeta.fields)) {
                mainEntityMeta.fields[fKey] = inheritedMeta.fields[fKey];
            }

            // merge options
            mainEntityMeta.options = Object.assign({}, inheritedMeta.options, mainEntityMeta.options);
            mainEntityMeta.options.updatedAt = mainEntityMeta.updated || inheritedMeta.updated || mainEntityMeta.options.updatedAt;
            mainEntityMeta.options.createdAt = mainEntityMeta.created || inheritedMeta.created || mainEntityMeta.options.updatedAt;

            for (let aKey of Object.keys(inheritedMeta.associations)) {
                let association = inheritedMeta.associations[aKey];

                // for many to many associations inherited from the parent we have to append to the through table name or override the model
                // or through options to create a new mapping table to prevent duplicate keys
                if (association.method === AssociationMethods.BELONGS_TO_MANY) {
                    // TODO: improve this? there is the potential to have conflicting table names using this approach
                    let manyToManyOptions: IEntityAssociation = Object.assign({}, association);
                    let mtoMAssn: BelongsToManyOptions = Object.assign({}, manyToManyOptions.association) as BelongsToManyOptions;
                    if (typeof mtoMAssn.through === 'string') {
                        mtoMAssn.through = entity.name + mtoMAssn.through;
                    } else {
                        if ((mtoMAssn.through as ThroughOptions).model != null) {
                            if (typeof (mtoMAssn.through as ThroughOptions).model === 'string') {
                                mtoMAssn.through = entity.name + (mtoMAssn.through as ThroughOptions).model;
                            } else {
                                mtoMAssn.through = entity.name + ((mtoMAssn.through as ThroughOptions).model as any).name;
                            }
                        } else {
                            throw new Error('invalid through options');
                        }
                    }
                    manyToManyOptions.association = mtoMAssn;
                    association = manyToManyOptions;
                }

                mainEntityMeta.associations[aKey] = association;
            }
        }
    }
}

function getEntityMeta(eObject: Object, key: string): IEntity {
    return (eObject as any).__sequelize_meta__.entities[key] as IEntity;
}

function getEntityKeys(entity: Function) {
    let keys: string[] = [];
    if (entity.prototype != null) {
        keys.push(entity.prototype.constructor.name);
    }

    if ((entity as any).__proto__ != null && (entity as any).__proto__.constructor.name !== 'Object') {
        keys = keys.concat(getEntityKeys((entity as any).__proto__));
    }

    return keys;
}

interface IEntity {
    name: string;
    fields: {
        [key: string]: ModelAttributeColumnOptions
    };
    associations: {
        [key: string]: IEntityAssociation;
    };
    options: ModelOptions<any>;
    updated: boolean | string;
    created: boolean | string;
}

interface IEntityAssociation {
    target: Function;
    method: string;
    association: AssociationOptions;
}

const AssociationMethods = {
    HAS_ONE: 'hasOne',
    BELONGS_TO: 'belongsTo',
    HAS_MANY: 'hasMany',
    BELONGS_TO_MANY: 'belongsToMany'
};

function getMeta(target: Object): IEntity {
    if (target.constructor == null) {
        throw new Error('Invalid Entity. Entities should be of type function/class.');
    }

    if ((target as any).__sequelize_meta__ == null) {
        (target as any).__sequelize_meta__ = {
            entities: {}
        };
    }

    let found: IEntity = (target as any).__sequelize_meta__.entities[target.constructor.name];

    if (found == null) {
        found = {
            name: target.constructor.name,
            associations: {},
            fields: {},
            options: {}
        } as IEntity;

        (target as any).__sequelize_meta__.entities[target.constructor.name] = found;
    }

    return found;
}

function clean(obj: any) {
    for (let key of Object.keys(obj)) {
        if (obj[key] == null) { delete obj[key]; }
    }
}