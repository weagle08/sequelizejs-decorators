# sequelizejs-decorators
Decorators for use with sequelize ORM. Version now follows the Sequelize library version (5.* -> 5.*) from version 5 onward.

## Getting Started

>*$ npm install sequelizejs-decorators sequelize*

you will want need to add the following to your **tsconfig.json** compiler options

>"emitDecoratorMetadata": true,  
>"experimentalDecorators": true

## Usage

Player.ts
```typescript
import {
    Entity, 
    PrimaryGeneratedColumn,
    Index,
    Column,
    CreatedDateColumn,
    UpdatedDateColumn,
    DataType,
    BelongsTo
    } from 'sequelizejs-decorators';
import {Team} from './Team';
import {IncludeAssociation, Model, Instance} from 'sequelize';

@Entity()
export class Player {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({
        type: DataType.STRING(100),
        allowNull: false
    })
    public name: string;

    @Column({
        type: DataType.INTEGER
    })
    public number: string;

    @CreatedDateColumn()
    public created: Date;

    @UpdatedDateColumn()
    public updated: Date;

    @BelongsTo(() => Team)
    public team: Team;
}

export interface PlayerInstance extends Instance<Player>, Player {
    setTeam(team: Team);
}

export interface PlayerModel extends Model<PlayerInstance, Player> {
    team: IncludeAssociation;
}
```

Team.ts
```typescript
import {
    Entity, 
    PrimaryGeneratedColumn,
    Index,
    Column,
    CreatedDateColumn,
    UpdatedDateColumn,
    DataType,
    HasMany,
    ManyToMany
    } from 'sequelizejs-decorators';
import {Player} from './Player';
import {IncludeAssociation, Model, Instance} from 'sequelize';

@Entity()
export class Team {
    @PrimaryGeneratedColumn()
    public id: number;

    @Index({
        unique: true
    })
    @Column({
        type: DataType.STRING(100),
        unique: true,
        allowNull: false
    })
    public name: string;

    @CreatedDateColumn()
    public created: Date;

    @UpdatedDateColumn()
    public updated: Date;

    @HasMany(() => Player)
    public players: Player[];

    @ManyToMany(() => Game, { through: 'TeamGames' })
    public games: Game[];
}

export interface TeamInstance extends Instance<Team>, Team {
    addPlayer(player: Player);
    addGame(game: Game);
}

export interface TeamModel extends Model<TeamInstance, Team> {
    players: IncludeAssociation;
    games: IncludeAssociation;
}
```
Game.ts

```typescript
import {
    Entity, 
    PrimaryGeneratedColumn,
    Column,
    CreatedDateColumn,
    UpdatedDateColumn,
    DataType,
    ManyToMany
    } from 'sequelizejs-decorators';
import {Team} from './Team';
import {IncludeAssociation, Model, Instance} from 'sequelize';

@Entity()
export class Game {
    @PrimaryGeneratedColumn()
    public id: number;

    @Column({
        type: DataType.STRING(200),
        allowNull: false
    })
    public location: string;

    @Column({
        type: DataType.DATE
    })
    pubilc time: Date;

    @CreatedDateColumn()
    public created: Date;

    @UpdatedDateColumn()
    public updated: Date;

    @ManyToMany(() => Team, { through: 'TeamGames' })
    public teams: Team[];
}

export interface GameInstance extends Instance<Game>, Game {
    addTeam(team: Team);
}

export interface GameModel extends Model<GameInstance, Game> {
    teams: IncludeAssociation;
}
```

Database.ts

```typescript
import { Options, Sequelize } from 'sequelize';
import SequelizeDb = require('sequelize');
import { Player, PlayerModel } from './Player';
import { Team, TeamModel } from './Team';
import { Game, GameModel } from './Game';
import { registerEntities } from 'sequelizejs-decorators';

export class Database {
    private _db: Sequelize;
    private _models: Models;

    /**
     * constructor
     * @param config database config options
     */
    public constructor(config: Options) {
        config.operatorsAliases = {};
        this._db = new SequelizeDb(config);
    }

    public get player(): PlayerModel {
        this.checkIfTableNull(this._models.Player);
        return this._models.Player as PlayerModel;
    }

    public get team(): TeamModel {
        this.checkIfTableNull(this._models.Team);
        return this._models.Team as TeamModel;
    }

    public get game(): GameModel {
        this.checkIfTableNull(this._models.Game);
        return this._models.Game as GameModel;
    }

    /**
     * initiates the database connection
     */
    public connect(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this._db.authenticate().then(() => {
                this._models = registerEntities(this._db, [
                    Player,
                    Team,
                    Game
                ]);

                this._db.sync().then(() => {
                    resolve(true);
                }).catch((ex: Error) => {
                    reject(ex);
                });
            }).catch((ex: Error) => {
                reject(ex);
            });
        });
    }

    /**
     * closes the database connection
     */
    public close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._db.close().then(() => {
                resolve();
            }).catch((ex: Error) => {
                reject(ex);
            });
        });
    }

    public async testConnection(): Promise<boolean> {
        await this._db.authenticate().catch(() => false);
        return true;
    }

    private checkIfTableNull(table: any): void {
        if (table == null) { throw new Error('database not initialized'); }
    }
}
```

index.ts
```typescript
import { Options, Sequelize } from 'sequelize';
import {Database} from './Database';

let dbOptions = {
    // sequelize options here
} as Options;

let dbInstance: Database = new Database(dbOptions);
dbInstance.connect().then(async () => {
    // now you can use db instance as your data access

    let player = await dbInstance.player.create({
        name: 'Michael Jordan',
        number: 23
    });

    // or

    let team = await dbInstance.team.create({
        name: 'Chicago Bulls',
        players: [
            {
                name: 'Michael Jordan',
                number: 23
            }
        ]
    }, {
        include: [
            { association: dbInstance.team.players }
        ]
    });
});
```
