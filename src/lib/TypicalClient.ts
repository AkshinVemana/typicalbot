/* eslint-disable @typescript-eslint/naming-convention */
import './extensions/TypicalGuild';
import './extensions/TypicalGuildMember';
import './extensions/TypicalMessage';

import * as Sentry from '@sentry/node';
import { Client, Collection, Intents } from 'discord.js';
import { TFunction } from 'i18next';
import fetch from 'node-fetch';
import { Client as VezaClient } from 'veza';
import { BanLog, UnbanLog } from './types/typicalbot';
import Logger from './utils/Logger';
import i18n from './utils/i18n';
import config from '../../etc/config.json';
import pkg from '../../package.json';
import AnalyticHandler from '../handlers/AnalyticHandler';
import CommandHandler from '../handlers/CommandHandler';
import DatabaseHandler from '../handlers/DatabaseHandler';
import EventHandler from '../handlers/EventHandler';
import ModerationLogHandler from '../handlers/ModerationLogHandler';
import PermissionsHandler from '../handlers/PermissionsHandler';
import SettingHandler from '../handlers/SettingHandler';
import TaskHandler from '../handlers/TaskHandler';

interface TypicalHandlers {
    database: DatabaseHandler;
    tasks: TaskHandler;
    permissions: PermissionsHandler;
    moderationLog: ModerationLogHandler;
}

export default class Cluster extends Client {
    public node: VezaClient | undefined;
    public config = config;
    public build = config.build;
    public shards: number[] = JSON.parse(process.env.SHARDS ?? '[1]');
    public shardCount = process.env.TOTAL_SHARD_COUNT ?? '1';
    public cluster = `${process.env.CLUSTER} [${this.shards.join(',')}]`;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    public handlers = {} as TypicalHandlers;
    public settings = new SettingHandler(this);
    public commands = new CommandHandler(this);
    public events = new EventHandler(this);
    public analytics = new AnalyticHandler(this);
    public caches = {
        bans: new Collection<string, BanLog>(),
        unbans: new Collection<string, UnbanLog>(),
        softbans: new Collection(),
        invites: new Collection<string, Collection<string, NodeJS.Timeout>>()
    };

    public translate: Map<string, TFunction> = new Map();
    public logger = new Logger();
    public version = pkg.version;
    public owners: string[] = [];

    public constructor(node: VezaClient | undefined) {
        super({
            messageCacheMaxSize: 300,
            messageCacheLifetime: 900,
            messageSweepInterval: 180,
            disableMentions: 'everyone',
            partials: ['MESSAGE'],
            presence: { activity: { name: `${config.prefix}help — typicalbot.com`, type: 'WATCHING' } },
            ws: {
                intents: Intents.FLAGS.GUILDS | Intents.FLAGS.GUILD_MEMBERS | Intents.FLAGS.GUILD_BANS |
                    Intents.FLAGS.GUILD_INVITES | Intents.FLAGS.GUILD_PRESENCES | Intents.FLAGS.GUILD_MESSAGES |
                    Intents.FLAGS.GUILD_MESSAGE_REACTIONS | Intents.FLAGS.DIRECT_MESSAGES |
                    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS
            }
        });

        Sentry.init({
            dsn: this.config.apis.sentry,
            release: this.version
        });

        this.node = node;

        this.login(this.config.token).catch((err) => Sentry.captureException(err));
    }

    public async login(token: string): Promise<string> {
        // MUST SETUP DATABASE BEFORE ANYTHING ELSE
        this.handlers.database = new DatabaseHandler(this);
        await this.handlers.database.init();

        this.handlers.tasks = new TaskHandler(this);
        this.handlers.permissions = new PermissionsHandler(this);
        this.handlers.moderationLog = new ModerationLogHandler(this);

        // Setup translation i18n before login to client
        this.translate = await i18n();
        this.logger.info('Loaded i18n Languages');

        return super.login(token);
    }

    public fetchData(property: string): any {
        if (!this.node) return eval(`this.${property}`);

        return this.node.sendTo('manager', {
            event: 'collectData',
            data: property
        }, { receptive: true });
    }

    public async sendStatistics(shardID: number): Promise<void> {
        fetch('https://www.carbonitex.net/discord/data/botdata.php', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                shardid: shardID,
                shardcount: this.shardCount.toString(),
                servercount: this.guilds.cache
                    .filter((g) => g.shardID === shardID)
                    .size.toString(),
                key: this.config.apis.carbonkey
            })
        }).catch((err) => {
            Sentry.captureException(err);
        });

        fetch(`https://top.gg/api/bots/${this.config.id}/stats`, {
            method: 'post',
            headers: {
                Authorization: this.config.apis.topgg,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                shard_id: shardID,
                shard_count: this.shardCount.toString(),
                server_count: this.guilds.cache
                    .filter((g) => g.shardID === shardID)
                    .size.toString()
            })
        }).catch((err) => {
            Sentry.captureException(err);
        });

        const guildCount = await this.fetchData('guilds.cache.size');

        fetch(`https://api.discordextremelist.xyz/v2/bot/${this.config.id}/stats`, {
            method: 'post',
            headers: {
                Authorization: this.config.apis.del,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                guildCount: guildCount,
                shardCount: this.shardCount
            })
        }).catch((err) => {
            Sentry.captureException(err);
        });

        fetch(`https://api.botlist.space/v1/bots/${this.config.id}`, {
            method: 'post',
            headers: {
                Authorization: this.config.apis.bls,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                server_count: guildCount
            })
        }).catch((err) => {
            Sentry.captureException(err);
        });
    }
}
