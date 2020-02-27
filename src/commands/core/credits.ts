import { MessageEmbed } from 'discord.js';
import Command from '../../structures/Command';
import Constants from '../../utility/Constants';
import { TypicalMessage } from '../../types/typicalbot';

export default class extends Command {
    dm = true;
    mode = Constants.Modes.STRICT;

    execute(message: TypicalMessage) {
        if (!message.embeddable)
            return message.send(message.translate('core/credits:TEXT'));

        return message.send(
            new MessageEmbed()
                .setColor(0x00adff)
                .setTitle(message.translate('core/credits:CREDITS'))
                .setDescription(message.translate('core/credits:TEXT'))
                .addFields([
                    {
                        name: '» Aklixio#0588 (84430408447426560)',
                        value: message.translate('core/credits:DESIGNER')
                    }
                ])
                .setFooter('TypicalBot', Constants.Links.ICON)
                .setTimestamp()
        );
    }
}
