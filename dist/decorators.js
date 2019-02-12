"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dtype = require('sequelize').DataTypes;
exports.DataType = dtype;
function Entity(name, options) {
    return (target) => {
        let meta = getMeta(target.prototype);
        if (typeof name === 'string') {
            meta.name = name;
        }
        else {
            meta.name = target.name;
            if (options == null && name != null && typeof name === 'object') {
                options = Object.assign({}, { name: name }, meta.options);
            }
        }
        meta.options = Object.assign({}, options, meta.options);
        if (meta.options.createdAt == null) {
            meta.options.createdAt = false;
        }
        if (meta.options.updatedAt == null) {
            meta.options.updatedAt = false;
        }
    };
}
exports.Entity = Entity;
function Column(attribute) {
    return (target, key) => {
        let meta = getMeta(target);
        meta.fields[key] = attribute;
    };
}
exports.Column = Column;
function CreatedDateColumn() {
    return (target, key) => {
        let meta = getMeta(target);
        meta.created = key;
    };
}
exports.CreatedDateColumn = CreatedDateColumn;
function UpdatedDateColumn() {
    return (target, key) => {
        let meta = getMeta(target);
        meta.updated = key;
    };
}
exports.UpdatedDateColumn = UpdatedDateColumn;
function PrimaryGeneratedColumn() {
    return (target, key) => {
        let meta = getMeta(target);
        meta.fields[key] = {
            primaryKey: true,
            type: exports.DataType.INTEGER,
            autoIncrement: true
        };
    };
}
exports.PrimaryGeneratedColumn = PrimaryGeneratedColumn;
function HasOne(typeFunction, options) {
    return (target, key) => {
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
exports.HasOne = HasOne;
function HasMany(typeFunction, options) {
    return (target, key) => {
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
exports.HasMany = HasMany;
function BelongsTo(typeFunction, options) {
    return (target, key) => {
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
exports.BelongsTo = BelongsTo;
function ManyToMany(typeFunction, options) {
    return (target, key) => {
        let meta = getMeta(target);
        if (options == null) {
            options = {};
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
exports.ManyToMany = ManyToMany;
function Index(options) {
    return (target, key) => {
        let meta = getMeta(target);
        if (meta.options.indexes == null) {
            meta.options.indexes = [];
        }
        if (options == null) {
            options = {};
        }
        let index = null;
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
            meta.options.indexes.push(index);
        }
        else {
            index.fields.push(key);
        }
        clean(index);
    };
}
exports.Index = Index;
function registerEntities(sequelize, entities) {
    for (let entity of entities) {
        mergeEntity(entity);
        let e = Object.create(entity.prototype);
        let meta = getMeta(e);
        meta.options.updatedAt = meta.updated || meta.options.updatedAt;
        meta.options.createdAt = meta.created || meta.options.createdAt;
        sequelize.define(meta.name, meta.fields, meta.options);
    }
    for (let entity of entities) {
        let e = Object.create(entity.prototype);
        let meta = getMeta(e);
        if (meta.associations != null) {
            let model = sequelize.models[entity.name];
            if (model != null) {
                for (let assnName of Object.keys(meta.associations)) {
                    let entityAssociation = meta.associations[assnName];
                    let targetName = entityAssociation.target().name;
                    model[assnName] = model[entityAssociation.method](sequelize.models[targetName], entityAssociation.association);
                }
            }
        }
    }
    return sequelize.models;
}
exports.registerEntities = registerEntities;
function mergeEntity(entity) {
    let keys = getEntityKeys(entity);
    keys.splice(0, 1);
    let e = Object.create(entity.prototype);
    let mainEntityMeta = getMeta(e);
    for (let key of keys) {
        let inheritedMeta = getEntityMeta(e, key);
        if (inheritedMeta != null) {
            for (let fKey of Object.keys(inheritedMeta.fields)) {
                mainEntityMeta.fields[fKey] = inheritedMeta.fields[fKey];
            }
            mainEntityMeta.options = Object.assign({}, inheritedMeta.options, mainEntityMeta.options);
            mainEntityMeta.options.updatedAt = mainEntityMeta.updated || inheritedMeta.updated || mainEntityMeta.options.updatedAt;
            mainEntityMeta.options.createdAt = mainEntityMeta.created || inheritedMeta.created || mainEntityMeta.options.updatedAt;
            for (let aKey of Object.keys(inheritedMeta.associations)) {
                let association = inheritedMeta.associations[aKey];
                if (association.method === AssociationMethods.BELONGS_TO_MANY) {
                    let manyToManyOptions = Object.assign({}, association);
                    let mtoMAssn = Object.assign({}, manyToManyOptions.association);
                    if (typeof mtoMAssn.through === 'string') {
                        mtoMAssn.through = entity.name + mtoMAssn.through;
                    }
                    else {
                        if (mtoMAssn.through.model != null) {
                            mtoMAssn.through = entity.name + mtoMAssn.through.model.name;
                        }
                        else {
                            mtoMAssn.through = entity.name + mtoMAssn.through.name;
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
function getEntityMeta(eObject, key) {
    return eObject.__sequelize_meta__.entities[key];
}
function getEntityKeys(entity) {
    let keys = [];
    if (entity.prototype != null) {
        keys.push(entity.prototype.constructor.name);
    }
    if (entity.__proto__ != null && entity.__proto__.constructor.name !== 'Object') {
        keys = keys.concat(getEntityKeys(entity.__proto__));
    }
    return keys;
}
const AssociationMethods = {
    HAS_ONE: 'hasOne',
    BELONGS_TO: 'belongsTo',
    HAS_MANY: 'hasMany',
    BELONGS_TO_MANY: 'belongsToMany'
};
function getMeta(target) {
    if (target.constructor == null) {
        throw new Error('Invalid Entity. Entities should be of type function/class.');
    }
    if (target.__sequelize_meta__ == null) {
        target.__sequelize_meta__ = {
            entities: {}
        };
    }
    let found = target.__sequelize_meta__.entities[target.constructor.name];
    if (found == null) {
        found = {
            name: target.constructor.name,
            associations: {},
            fields: {},
            options: {}
        };
        target.__sequelize_meta__.entities[target.constructor.name] = found;
    }
    return found;
}
function clean(obj) {
    for (let key of Object.keys(obj)) {
        if (obj[key] == null) {
            delete obj[key];
        }
    }
}

//# sourceMappingURL=decorators.js.map
