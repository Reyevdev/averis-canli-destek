import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import config from '../config.json' with { type: 'json' };
import { AI_SUPPORT_CHANNEL_ID } from './ai/constants.js';
import soruCommand from './commands/soru.js';

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js') && file !== 'soru.js');

for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    client.commands.set(command.default.data.name, command.default);
}

client.once('ready', () => {
    console.log(`${client.user.tag} aktif!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.id === AI_SUPPORT_CHANNEL_ID) {
        await message.delete().catch(() => {});
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ekip_kategori') {
            const command = client.commands.get('ekipalımlarıaç');
            if (command && command.handleSelect) await command.handleSelect(interaction);
            return;
        }
        if (interaction.customId === 'ticket_menu') {
            const command = client.commands.get('destektalebimesajı');
            if (command && command.handleSelect) await command.handleSelect(interaction);
            return;
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('basvuru_')) {
            const command = client.commands.get('ekipalımlarıaç');
            if (command && command.handleButton) await command.handleButton(interaction);
            return;
        }
        if (interaction.customId.startsWith('ticket_')) {
            const command = client.commands.get('destektalebimesajı');
            if (command && command.handleButton) await command.handleButton(interaction);
            return;
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'guncellemeModal') {
            const command = client.commands.get('guncellemenotu');
            if (command && command.handleModal) await command.handleModal(interaction);
        } else if (interaction.customId.startsWith('modal_duyuru_')) {
            const command = client.commands.get('duyuru');
            if (command && command.handleModal) await command.handleModal(interaction);
        } else if (interaction.customId.startsWith('modal_')) {
            const command = client.commands.get('ekipalımlarıaç');
            if (command && command.handleModal) await command.handleModal(interaction);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === soruCommand.data.name) {
        try {
            await soruCommand.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Bir hata oluştu!', ephemeral: true });
        }
        return;
    }

    if (interaction.channel.id === AI_SUPPORT_CHANNEL_ID && interaction.commandName !== soruCommand.data.name) {
        try {
            await interaction.reply({ content: 'Bu kanalda sadece /soru komutunu kullanabilirsin!', ephemeral: true });
        } catch {}
        return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Komut çalıştırılırken bir hata oluştu!', ephemeral: true });
    }
});

client.login(config.token);