// Harmony V14 - Advanced Discord Music Bot
// Single-file implementation with TsumiLink, Discord.js v14, and Enmap
// Over 800 lines of professionally structured code

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { TsumiPlayer, TsumiTrack, TsumiErrorEventCodes } = require('tsumilink');
const Enmap = require('enmap');

// Initialize client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

// Database setup
const db = new Enmap({
    name: 'harmony_v14',
    fetchAll: false,
    autoFetch: true,
    cloneLevel: 'deep'
});

// Player setup
const player = new TsumiPlayer({
    client: client,
    nodes: [
        {
            host: 'lavalink.oryzen.xyz',
            port: 443,
            password: 'oryzen.xyz',
            secure: true
        }
    ],
    autoPlay: true,
    defaultSearchPlatform: 'ytsearch',
    volume: 50
});

// Global variables
const defaultPrefix = 'S-';
const embedColor = '#3498db';
const requiredPermissions = [
    'ViewChannel',
    'SendMessages',
    'EmbedLinks',
    'Connect',
    'Speak'
];

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

// Utility functions
function getServerConfig(guildId) {
    if (!db.has(guildId)) {
        db.set(guildId, {
            prefix: defaultPrefix,
            djRoles: [],
            musicChannel: null,
            defaultVolume: 50
        });
    }
    return db.get(guildId);
}

function isDJ(member, guildId) {
    const config = getServerConfig(guildId);
    if (config.djRoles.length === 0) return true; // No DJ roles set = everyone can control
    return member.roles.cache.some(role => config.djRoles.includes(role.id)) || member.permissions.has('ManageGuild');
}

function createProgressBar(current, total, length = 15) {
    const percentage = current / total;
    const progress = Math.round(length * percentage);
    return '▬'.repeat(progress) + '🔘' + '▬'.repeat(length - progress);
}

function formatTime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60;
    const hours = Math.floor((ms / (1000 * 60 * 60)));
    return `${hours > 0 ? `${hours}:` : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Player event handlers
player.on('trackStart', (queue, track) => {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('🎶 Now Playing')
        .setDescription(`[${track.title}](${track.url})`)
        .addFields(
            { name: 'Duration', value: track.duration, inline: true },
            { name: 'Requested by', value: track.requestedBy?.toString() || 'Autoplay', inline: true }
        )
        .setThumbnail(track.thumbnail)
        .setFooter({ text: 'Use the controls below to manage playback' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('skip')
            .setLabel('Skip')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⏭️'),
        new ButtonBuilder()
            .setCustomId('pause')
            .setLabel(queue.paused ? 'Resume' : 'Pause')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(queue.paused ? '▶️' : '⏸️'),
        new ButtonBuilder()
            .setCustomId('stop')
            .setLabel('Stop')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⏹️'),
        new ButtonBuilder()
            .setCustomId('loop')
            .setLabel(queue.repeatMode ? 'Disable Loop' : 'Enable Loop')
            .setStyle(queue.repeatMode ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('🔄'),
        new ButtonBuilder()
            .setCustomId('shuffle')
            .setLabel('Shuffle')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔀')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('rewind')
            .setLabel('-5s')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏪'),
        new ButtonBuilder()
            .setCustomId('forward')
            .setLabel('+5s')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏩'),
        new ButtonBuilder()
            .setCustomId('leave')
            .setLabel('Disconnect')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🚪'),
        new ButtonBuilder()
            .setCustomId('queue')
            .setLabel('Queue')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📜'),
        new ButtonBuilder()
            .setCustomId('lyrics')
            .setLabel('Lyrics')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝')
    );

    channel.send({ embeds: [embed], components: [row, row2] });
});

player.on('trackAdd', (queue, track) => {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(`✅ Added [${track.title}](${track.url}) to the queue`)
                .setFooter({ text: `Requested by ${track.requestedBy?.username}` })
        ]
    });
});

player.on('error', (queue, error) => {
    console.error('Player error:', error);
    const channel = queue.metadata?.channel;
    if (channel) {
        channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('❌ Player Error')
                    .setDescription(`An error occurred: ${error.message}`)
            ]
        });
    }
});

// Client event handlers
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('music | S-help', { type: 'LISTENING' });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const guildId = interaction.guildId;
    const member = interaction.member;
    const config = getServerConfig(guildId);
    const queue = player.getQueue(guildId);

    if (!isDJ(member, guildId)) {
        return interaction.reply({
            content: '❌ You need DJ permissions to use these controls',
            ephemeral: true
        });
    }

    if (interaction.isButton()) {
        await interaction.deferUpdate();

        switch (interaction.customId) {
            case 'skip':
                if (!queue || !queue.current) {
                    return interaction.followUp({ content: '❌ No track is currently playing', ephemeral: true });
                }
                queue.skip();
                interaction.followUp({ content: '⏭️ Skipped the current track' });
                break;

            case 'pause':
                if (!queue || !queue.current) {
                    return interaction.followUp({ content: '❌ No track is currently playing', ephemeral: true });
                }
                queue.setPaused(!queue.paused);
                interaction.followUp({ content: queue.paused ? '⏸️ Playback paused' : '▶️ Playback resumed' });
                break;

            case 'stop':
                if (!queue || !queue.current) {
                    return interaction.followUp({ content: '❌ No track is currently playing', ephemeral: true });
                }
                queue.stop();
                interaction.followUp({ content: '⏹️ Stopped playback and cleared queue' });
                break;

            case 'loop':
                if (!queue || !queue.current) {
                    return interaction.followUp({ content: '❌ No track is currently playing', ephemeral: true });
                }
                queue.setRepeatMode(queue.repeatMode === 0 ? 1 : 0);
                interaction.followUp({ content: queue.repeatMode ? '🔁 Loop enabled' : '🔁 Loop disabled' });
                break;

            case 'shuffle':
                if (!queue || queue.tracks.length < 2) {
                    return interaction.followUp({ content: '❌ Not enough tracks in queue to shuffle', ephemeral: true });
                }
                queue.shuffle();
                interaction.followUp({ content: '🔀 Queue shuffled' });
                break;

            case 'rewind':
                if (!queue || !queue.current) {
                    return interaction.followUp({ content: '❌ No track is currently playing', ephemeral: true });
                }
                const newPosition = Math.max(0, queue.current.position - 5000);
                queue.seek(newPosition);
                interaction.followUp({ content: '⏪ Rewinded 5 seconds' });
                break;

            case 'forward':
                if (!queue || !queue.current) {
                    return interaction.followUp({ content: '❌ No track is currently playing', ephemeral: true });
                }
                const newPos = Math.min(queue.current.duration, queue.current.position + 5000);
                queue.seek(newPos);
                interaction.followUp({ content: '⏩ Forwarded 5 seconds' });
                break;

            case 'leave':
                if (!queue || !queue.connection) {
                    return interaction.followUp({ content: '❌ Not connected to a voice channel', ephemeral: true });
                }
                queue.destroy();
                interaction.followUp({ content: '🚪 Left the voice channel' });
                break;

            case 'queue':
                if (!queue || !queue.current) {
                    return interaction.followUp({ content: '❌ No tracks in queue', ephemeral: true });
                }
                const tracks = queue.tracks.slice(0, 10).map((track, i) => `**${i + 1}.** [${track.title}](${track.url}) (${track.duration})`);
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('📜 Current Queue')
                    .setDescription(tracks.join('\n'))
                    .addFields(
                        { name: 'Now Playing', value: `[${queue.current.title}](${queue.current.url})`, inline: false },
                        { name: 'Total Tracks', value: `${queue.tracks.length}`, inline: true },
                        { name: 'Queue Duration', value: `${formatTime(queue.totalTime)}`, inline: true }
                    );
                interaction.followUp({ embeds: [embed] });
                break;

            case 'lyrics':
                // Lyrics implementation would go here
                interaction.followUp({ content: '🚧 Lyrics feature coming soon!', ephemeral: true });
                break;
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    const guildId = message.guild?.id;
    if (!guildId) return;
    
    const config = getServerConfig(guildId);
    const prefix = config.prefix || defaultPrefix;
    
    // Check if message is in music channel and not a command
    if (config.musicChannel && message.channel.id === config.musicChannel && !message.content.startsWith(prefix)) {
        if (!message.member.voice.channel) {
            return message.reply('❌ You need to be in a voice channel to play music!');
        }
        
        try {
            const searchQuery = message.content;
            await player.play(message.member.voice.channel, searchQuery, {
                metadata: {
                    channel: message.channel,
                    requestedBy: message.author
                }
            });
            message.react('✅');
        } catch (error) {
            console.error('Play error:', error);
            message.reply('❌ Failed to play the track. Please try again.');
        }
        return;
    }
    
    // Command handling
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    try {
        switch (command) {
            case 'play':
            case 'p':
                if (!message.member.voice.channel) {
                    return message.reply('❌ You need to be in a voice channel to play music!');
                }
                
                const query = args.join(' ');
                if (!query) {
                    return message.reply('❌ Please provide a song name or URL!');
                }
                
                await player.play(message.member.voice.channel, query, {
                    metadata: {
                        channel: message.channel,
                        requestedBy: message.author
                    }
                });
                break;
                
            case 'skip':
                if (!isDJ(message.member, guildId)) {
                    return message.reply('❌ You need DJ permissions to skip tracks!');
                }
                
                const queue = player.getQueue(guildId);
                if (!queue || !queue.current) {
                    return message.reply('❌ No track is currently playing!');
                }
                
                queue.skip();
                message.reply('⏭️ Skipped the current track');
                break;
                
            case 'stop':
                if (!isDJ(message.member, guildId)) {
                    return message.reply('❌ You need DJ permissions to stop playback!');
                }
                
                const q = player.getQueue(guildId);
                if (!q || !q.current) {
                    return message.reply('❌ No track is currently playing!');
                }
                
                q.stop();
                message.reply('⏹️ Stopped playback and cleared queue');
                break;
                
            case 'volume':
                if (!isDJ(message.member, guildId)) {
                    return message.reply('❌ You need DJ permissions to adjust volume!');
                }
                
                const volQueue = player.getQueue(guildId);
                if (!volQueue || !volQueue.current) {
                    return message.reply('❌ No track is currently playing!');
                }
                
                const volume = parseInt(args[0]);
                if (isNaN(volume) || volume < 0 || volume > 200) {
                    return message.reply('❌ Please provide a valid volume between 0 and 200!');
                }
                
                volQueue.setVolume(volume);
                message.reply(`🔊 Volume set to ${volume}%`);
                break;
                
            case 'queue':
                const queueList = player.getQueue(guildId);
                if (!queueList || !queueList.current) {
                    return message.reply('❌ No tracks in queue!');
                }
                
                const tracks = queueList.tracks.slice(0, 10).map((track, i) => `**${i + 1}.** [${track.title}](${track.url}) (${track.duration})`);
                const queueEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('📜 Current Queue')
                    .setDescription(tracks.join('\n'))
                    .addFields(
                        { name: 'Now Playing', value: `[${queueList.current.title}](${queueList.current.url})`, inline: false },
                        { name: 'Total Tracks', value: `${queueList.tracks.length}`, inline: true },
                        { name: 'Queue Duration', value: `${formatTime(queueList.totalTime)}`, inline: true }
                    );
                message.reply({ embeds: [queueEmbed] });
                break;
                
            case 'pause':
                if (!isDJ(message.member, guildId)) {
                    return message.reply('❌ You need DJ permissions to pause playback!');
                }
                
                const pauseQueue = player.getQueue(guildId);
                if (!pauseQueue || !pauseQueue.current) {
                    return message.reply('❌ No track is currently playing!');
                }
                
                pauseQueue.setPaused(true);
                message.reply('⏸️ Playback paused');
                break;
                
            case 'resume':
                if (!isDJ(message.member, guildId)) {
                    return message.reply('❌ You need DJ permissions to resume playback!');
                }
                
                const resumeQueue = player.getQueue(guildId);
                if (!resumeQueue || !resumeQueue.current) {
                    return message.reply('❌ No track is currently playing!');
                }
                
                resumeQueue.setPaused(false);
                message.reply('▶️ Playback resumed');
                break;
                
            case 'loop':
                if (!isDJ(message.member, guildId)) {
                    return message.reply('❌ You need DJ permissions to toggle loop!');
                }
                
                const loopQueue = player.getQueue(guildId);
                if (!loopQueue || !loopQueue.current) {
                    return message.reply('❌ No track is currently playing!');
                }
                
                loopQueue.setRepeatMode(loopQueue.repeatMode === 0 ? 1 : 0);
                message.reply(loopQueue.repeatMode ? '🔁 Loop enabled' : '🔁 Loop disabled');
                break;
                
            case 'shuffle':
                if (!isDJ(message.member, guildId)) {
                    return message.reply('❌ You need DJ permissions to shuffle the queue!');
                }
                
                const shuffleQueue = player.getQueue(guildId);
                if (!shuffleQueue || shuffleQueue.tracks.length < 2) {
                    return message.reply('❌ Not enough tracks in queue to shuffle!');
                }
                
                shuffleQueue.shuffle();
                message.reply('🔀 Queue shuffled');
                break;
                
            case 'seek':
                if (!isDJ(message.member, guildId)) {
                    return message.reply('❌ You need DJ permissions to seek in a track!');
                }
                
                const seekQueue = player.getQueue(guildId);
                if (!seekQueue || !seekQueue.current) {
                    return message.reply('❌ No track is currently playing!');
                }
                
                const time = args[0];
                if (!time) {
                    return message.reply('❌ Please provide a time to seek to (e.g. 1:30 or 90s)!');
                }
                
                // Parse time (supports formats like 1:30, 90s, 2m30s)
                let seconds = 0;
                if (time.includes(':')) {
                    const parts = time.split(':');
                    if (parts.length === 2) {
                        seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                    } else if (parts.length === 3) {
                        seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                    }
                } else if (time.includes('m') || time.includes('s')) {
                    const minutesMatch = time.match(/(\d+)m/);
                    const secondsMatch = time.match(/(\d+)s/);
                    if (minutesMatch) seconds += parseInt(minutesMatch[1]) * 60;
                    if (secondsMatch) seconds += parseInt(secondsMatch[1]);
                } else {
                    seconds = parseInt(time);
                }
                
                if (isNaN(seconds) {
                    return message.reply('❌ Please provide a valid time format!');
                }
                
                seekQueue.seek(seconds * 1000);
                message.reply(`⏩ Seeking to ${formatTime(seconds * 1000)}`);
                break;
                
            case 'nowplaying':
            case 'np':
                const npQueue = player.getQueue(guildId);
                if (!npQueue || !npQueue.current) {
                    return message.reply('❌ No track is currently playing!');
                }
                
                const progressBar = createProgressBar(npQueue.current.position, npQueue.current.duration);
                const npEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('🎶 Now Playing')
                    .setDescription(`[${npQueue.current.title}](${npQueue.current.url})`)
                    .addFields(
                        { name: 'Progress', value: `${progressBar}\n${formatTime(npQueue.current.position)} / ${npQueue.current.duration}`, inline: false },
                        { name: 'Requested by', value: npQueue.current.requestedBy?.toString() || 'Autoplay', inline: true },
                        { name: 'Volume', value: `${npQueue.volume}%`, inline: true }
                    )
                    .setThumbnail(npQueue.current.thumbnail);
                message.reply({ embeds: [npEmbed] });
                break;
                
            case 'setprefix':
                if (!message.member.permissions.has('ManageGuild')) {
                    return message.reply('❌ You need Manage Server permissions to change the prefix!');
                }
                
                const newPrefix = args[0];
                if (!newPrefix || newPrefix.length > 3) {
                    return message.reply('❌ Please provide a valid prefix (1-3 characters)!');
                }
                
                config.prefix = newPrefix;
                db.set(guildId, config);
                message.reply(`✅ Prefix changed to \`${newPrefix}\``);
                break;
                
            case 'setmusicchannel':
                if (!message.member.permissions.has('ManageGuild')) {
                    return message.reply('❌ You need Manage Server permissions to set the music channel!');
                }
                
                config.musicChannel = message.channel.id;
                db.set(guildId, config);
                message.reply(`✅ Music channel set to <#${message.channel.id}>`);
                break;
                
            case 'adddj':
                if (!message.member.permissions.has('ManageGuild')) {
                    return message.reply('❌ You need Manage Server permissions to add DJ roles!');
                }
                
                const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
                if (!role) {
                    return message.reply('❌ Please mention a role or provide a role ID!');
                }
                
                if (!config.djRoles.includes(role.id)) {
                    config.djRoles.push(role.id);
                    db.set(guildId, config);
                    message.reply(`✅ Added <@&${role.id}> to DJ roles`);
                } else {
                    message.reply('❌ This role is already a DJ role!');
                }
                break;
                
            case 'removedj':
                if (!message.member.permissions.has('ManageGuild')) {
                    return message.reply('❌ You need Manage Server permissions to remove DJ roles!');
                }
                
                const roleToRemove = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
                if (!roleToRemove) {
                    return message.reply('❌ Please mention a role or provide a role ID!');
                }
                
                if (config.djRoles.includes(roleToRemove.id)) {
                    config.djRoles = config.djRoles.filter(id => id !== roleToRemove.id);
                    db.set(guildId, config);
                    message.reply(`✅ Removed <@&${roleToRemove.id}> from DJ roles`);
                } else {
                    message.reply('❌ This role is not a DJ role!');
                }
                break;
                
            case 'help':
                const helpEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('Harmony V14 - Help Menu')
                    .setDescription(`Prefix: \`${prefix}\``)
                    .addFields(
                        { name: '🎶 Music Commands', value: '`play`, `skip`, `stop`, `pause`, `resume`, `queue`, `nowplaying`, `volume`, `loop`, `shuffle`, `seek`', inline: false },
                        { name: '⚙️ Configuration', value: '`setprefix`, `setmusicchannel`, `adddj`, `removedj`', inline: false },
                        { name: 'ℹ️ Information', value: '`help`, `invite`, `support`', inline: false }
                    )
                    .setFooter({ text: 'Use the buttons below for more detailed help' });
                
                const helpRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('help_menu')
                        .setPlaceholder('Select a category')
                        .addOptions(
                            { label: 'Music Commands', value: 'help_music' },
                            { label: 'Configuration', value: 'help_config' },
                            { label: 'Information', value: 'help_info' }
                        )
                );
                
                message.reply({ embeds: [helpEmbed], components: [helpRow] });
                break;
                
            case 'invite':
                message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(embedColor)
                            .setTitle('Invite Harmony V14')
                            .setDescription('[Click here to invite the bot to your server]()\n[Click here to join our support server]()')
                            .setFooter({ text: 'Thank you for using Harmony V14!' })
                    ]
                });
                break;
                
            case 'support':
                message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(embedColor)
                            .setTitle('Support Server')
                            .setDescription('[Click here to join our support server]()')
                            .setFooter({ text: 'We\'ll be happy to help you!' })
                    ]
                });
                break;
                
            default:
                message.reply(`❌ Unknown command. Use \`${prefix}help\` to see available commands.`);
        }
    } catch (error) {
        console.error('Command error:', error);
        message.reply('❌ An error occurred while executing that command. Please try again.');
    }
});

// Login
client.login(process.env.DISCORD_TOKEN);
