import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { AI_SUPPORT_CHANNEL_ID } from '../ai/constants.js';
import { askGemini } from '../ai/askGemini.js';

function truncate(text, max = 1024) {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 3)}...`;
}

const data = new SlashCommandBuilder()
	.setName('soru')
	.setDescription('Averis Craft yapay zeka destek botuna soru sor')
	.addStringOption(option =>
		option
			.setName('mesaj')
			.setDescription('Sormak istediğin soru')
			.setRequired(true)
			.setMaxLength(1000)
	);

async function execute(interaction) {
	if (interaction.channel.id !== AI_SUPPORT_CHANNEL_ID) {
		await interaction.reply({
			content: `Bu komutu sadece <#${AI_SUPPORT_CHANNEL_ID}> kanalında kullanabilirsin.`,
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const question = interaction.options.getString('mesaj', true).trim();

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	let answer;
	try {
		answer = await askGemini(interaction.user.id, question);
	} catch (error) {
		console.error(error);
		answer = 'Şu anda cevap veremiyorum, birazdan tekrar dener misin?';
	}

	const embed = new EmbedBuilder()
		.setColor(0xff8c00)
		.setAuthor({ name: 'Averis Craft Yapay Zeka Destek' })
		.addFields(
			{ name: '❓ Sorunuz', value: truncate(question) },
			{ name: '💬 Cevap', value: truncate(answer) },
		)
		.setFooter({ text: `${interaction.guild?.name ?? 'Averis Craft'} • mc.AverisCraft.com` })
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };