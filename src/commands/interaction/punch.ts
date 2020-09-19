import Command from '../../lib/structures/Command';
import { TypicalGuildMessage } from '../../lib/types/typicalbot';

export default class extends Command {
    execute(message: TypicalGuildMessage) {
        const mention = message.mentions.users.first();

        const randomAddon = Math.random() <= 0.25;

        if (!mention || mention.id === message.author.id)
            return message.reply(message.translate('interaction/punch:SELF'));

        return message.reply(message.translate(randomAddon ? 'interaction/punch:RESPONSE_JAW' : 'interaction/punch:RESPONSE', {
            user: mention.toString()
        }));
    }
}
