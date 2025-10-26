// Install these packages first:
// npm install mineflayer
// npm install mineflayer-pathfinder
// npm install prismarine-world
// npm install prismarine-block
// npm install vec3

const mineflayer = require('mineflayer');
const { pathfinder, goals, Movements } = require('mineflayer-pathfinder');
const { GoalBlock, GoalNear, GoalFollow, GoalBreakBlock } = goals;
const { Vec3 } = require('vec3');

// Bot configuration (do not change)
const botConfig = {
    host: 'ip',
    username: 'bleen',
    version: '1.21.5' // Make sure this matches your server version exactly
};

// --- Template Section: You can customize below this line ---

let bot;

let inventoryCheckInterval;

// --- Bot Initialization ---
function createBot(ip) {
    botConfig.host = ip; // Update the host dynamically
    bot = mineflayer.createBot(botConfig);

    bot.loadPlugin(pathfinder);

    bot.on('login', () => {
        console.log(`${bot.username} has logged in!`);
        //('Hello! I am your progression bot and will start automatically.');
    });

    bot.on('spawn', () => {
        console.log('Bot spawned in the world!');
        bot.chat("/login bleen1_")
    });

    bot.on('kicked', (reason, loggedIn) => {
        console.log(`Bot was kicked: ${reason}`);
        if (inventoryCheckInterval) clearInterval(inventoryCheckInterval);
        console.log('Attempting to reconnect in 5 seconds...');
        setTimeout(() => {
            main();
        }, 5000);
    });

    bot.on('error', err => {
        console.error(`Bot error: ${err.message}`);
        if (inventoryCheckInterval) clearInterval(inventoryCheckInterval);
        console.log('Attempting to reconnect in 5 seconds...');
        setTimeout(() => {
            main();
        }, 5000);
    });

    bot.on('end', () => {
        console.log('Bot disconnected.');
        if (inventoryCheckInterval) clearInterval(inventoryCheckInterval);
        
    });
    // Listen for normal chat messages
    bot.on('chat', (username, message) => {
        // Don't print the bot's own messages
        if (username !== bot.username) {
            console.log(`[${username}] ${message}`);
        }
    });

    // Listen for plugin/command messages (server messages, plugin output, etc.)
    bot.on('message', (jsonMsg) => {
        // Print all messages (including the bot's own and server/plugin messages)
        let sender = 'server';
        let text = '';

        // Try to extract sender and message from jsonMsg
        if (jsonMsg.extra && Array.isArray(jsonMsg.extra)) {
            // Look for a 'text' property and an 'extra' with a username
            for (const part of jsonMsg.extra) {
            if (part.text && part.text.trim() !== '') {
                if (part.color === 'gray' && !text) {
                // Sometimes server messages are gray
                text = part.text.trim();
                } else if (part.bold && part.text) {
                // Sometimes usernames are bold
                sender = part.text.trim();
                } else if (!text) {
                text = part.text.trim();
                }
            }
            }
        }
        // Fallback for simple messages
        if (!text && jsonMsg.text) {
            text = jsonMsg.text.trim();
        }
        // If sender is still 'server' and text contains ':', try to split
        if (sender === 'server' && text.includes(':')) {
            const idx = text.indexOf(':');
            sender = text.slice(0, idx).trim();
            text = text.slice(idx + 1).trim();
        }
        if (text) {
            console.log(`[${sender}] ${text}`);
        }
    });
}
 
// ...existing code...

// --- Console Command Interface ---
const readline = require('readline');
const mcData = require('minecraft-data')(botConfig.version);
// Create a readline interface for console input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function handleConsoleInput(line) {
    if (!bot || !bot.entity) {
        console.log("Bot not ready yet.");
        return;
    }
    const args = line.trim().split(' ');
    const cmd = args[0].toLowerCase();

    if (cmd === 'goto' && args.length === 4) {
        // Usage: goto x y z
        const x = Number(args[1]);
        const y = Number(args[2]);
        const z = Number(args[3]);
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            console.log("Usage: goto <x> <y> <z>");
            return;
        }
        const goal = new GoalBlock(x, y, z);
        bot.pathfinder.setMovements(new Movements(bot, mcData));
        bot.pathfinder.setGoal(goal);
        console.log(`Going to (${x}, ${y}, ${z})`);
        } else if (cmd === 'stop') {
        bot.pathfinder.setGoal(null);
        console.log("Stopped pathfinding.");
    }else if (cmd === 'afkmove'){
        if (bot._afkMoveInterval) {
            clearInterval(bot._afkMoveInterval);
            bot._afkMoveInterval = null;
            bot.setControlState('forward', false);
            bot.setControlState('back', false);
            console.log("Stopped AFK movement.");
        } else {
            let movingForward = true;
            bot._afkMoveInterval = setInterval(() => {
                if (movingForward) {
                    bot.setControlState('forward', true);
                    bot.setControlState('back', false);
                } else {
                    bot.setControlState('forward', false);
                    bot.setControlState('back', true);
                }
                movingForward = !movingForward;
            }, 2000); // Switch every 2 seconds
            console.log("Started AFK movement (forward/backward). Run 'afkmove' again to stop.");
        }
    } else if(cmd === 'follow') {
        // Usage: follow <username>
        const targetName = args[1];
        if (!targetName) {
            console.log("Usage: follow <username>");
            return;
        }
        const target = bot.players[targetName];
        if (!target || !target.entity) {
            console.log(`Player "${targetName}" not found or not online.`);
            return;
        }
        // Use a very large follow distance so the bot will always follow, regardless of distance
        const goal = new GoalFollow(target.entity, Number.MAX_SAFE_INTEGER);
        bot.pathfinder.setMovements(new Movements(bot, mcData));
        bot.pathfinder.setGoal(goal, true); // 'true' for dynamic goal updating
        console.log(`Following ${targetName} (no distance limit).`);

    } else if (cmd === 'manhunt'){
        // Usage: manhunt <username>
        // Follows and attacks the target player
        const targetName = args[1];
        if (!targetName) {
            console.log("Usage: manhunt <username>");
            return;
        }
        const target = bot.players[targetName];
        if (!target || !target.entity) {
            console.log(`Player "${targetName}" not found or not online.`);
            return;
        }
        bot.pathfinder.setMovements(new Movements(bot, mcData));
        const goal = new GoalFollow(target.entity, 2);
        bot.pathfinder.setGoal(goal, true);

        let attackInterval = setInterval(() => {
            if (!target.entity || !bot.entity) {
            clearInterval(attackInterval);
            return;
            }
            const dist = bot.entity.position.distanceTo(target.entity.position);
            if (dist <= 3) {
            // Try to equip sword if available
            const sword = bot.inventory.items().find(i => i.name.includes('sword'));
            if (sword) {
                bot.equip(sword, 'hand', () => {
                bot.lookAt(target.entity.position.offset(0, 1.5, 0), true, () => {
                    bot.attack(target.entity);
                });
                });
            } else {
                bot.attack(target.entity);
            }
            }
        }, 500);

        // Stop attacking if target dies or bot dies
        function stopManhunt() {
            clearInterval(attackInterval);
        }
        // bot.once('death', stopManhunt);
        bot.on('entityDead', (entity) => {
            if (entity === target.entity) {
            console.log(`${targetName} has been killed!`);
            stopManhunt();
            }
        });if (cmd === 'stopfollow') {
        bot.pathfinder.setGoal(null);
        console.log("Stopped following."); }
    } else if (cmd === 'killenemy'){
        // Usage: killenemy <username>
        const targetName = args[1];
        if (!targetName) {
            console.log("Usage: killenemy <username>");
            return;
        }
        const target = bot.players[targetName];
        if (!target || !target.entity) {
            console.log(`Player "${targetName}" not found or not online.`);
            return;
        }
        bot.attack(target.entity, (err) => {
            if (err) {
                console.error(`Failed to attack ${targetName}: ${err.message}`);
            } else {
                console.log(`Attacking ${targetName}.`);
            }
        });

    }else if (cmd === 'leave') {
        bot.quit();
        console.log("Bot is quitting.");
    } else if (cmd === "join"){
        main(); 
    }else if (cmd === 'chat') {
        // Usage: chat your message here
        const message = args.slice(1).join(' ');
        bot.chat(message);
    } else if (cmd === 'pos') {
        const pos = bot.entity.position;
        console.log(`Current position: ${pos.x}, ${pos.y}, ${pos.z}`);
    } else if (cmd === 'jump'){
        // Usage: jump
        bot.setControlState('jump', true);
        setTimeout(() => {
            bot.setControlState('jump', false);
            console.log("Jumped.");
        })
    } else if (cmd === 'end'){
        exit();
    } else if (cmd === 'slave') {
                // Usage: slave dirt  OR  slave diamonds
                function isDiggable(block) {
                    if (!block) return false;
                    const grassId = mcData.blocksByName.grass_block.id;
                    const dirtId = mcData.blocksByName.dirt.id;
                    return block.type === grassId || block.type === dirtId;
                }

                async function digLoop() {
                    while (true) {
                        // Check if shovel is still in hand and not broken
                        const handItem = bot.inventory.slots[bot.getEquipmentDestSlot('hand')];
                        if (!handItem || !handItem.name.includes('shovel')) {
                            console.log("Shovel is broken or missing.");
                            break;
                        }

                        // Find nearest grass block or dirt
                        const block = bot.findBlock({
                            matching: isDiggable,
                            maxDistance: 32
                        });

                        if (!block) {
                            console.log("No grass block or dirt found nearby.");
                            break;
                        }

                        // Pathfind to block
                        await bot.pathfinder.goto(new GoalNear(block.position.x, block.position.y, block.position.z, 1));

                        // Dig the block
                        try {
                            await bot.dig(block);
                            console.log(`Dug ${block.name} at ${block.position}`);
                        } catch (err) {
                            console.log(`Failed to dig: ${err.message}`);
                            break;
                        }
                    }
                }

                const itemName = args[1] ? args[1].toLowerCase() : '';
                if (itemName === 'dirt' || itemName === 'diamond') {
                    // Try to equip any shovel in inventory
                    const shovel = bot.inventory.items().find(i => i.name.includes('shovel'));
                    if (!shovel) {
                        console.log("No shovel found in inventory.");
                        return;
                    }
                    bot.equip(shovel, 'hand', (err) => {
                        if (err) {
                            console.error(`Failed to equip shovel: ${err.message}`);
                        } else {
                            console.log(`Equipped ${shovel.displayName}.`);
                            digLoop();
                        }
                    });
                } else if (itemName === 'diamonds') {
                    // Find nearest diamond ore block
                    const diamondOre = bot.findBlock({
                        matching: mcData.blocksByName.diamond_ore.id,
                        maxDistance: 100
                    });

                    if (!diamondOre) {
                        console.log("No diamond ore found nearby.");
                        return;
                    }
                    // Try to equip any pickaxe in inventory
                    const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
                    if (!pickaxe) {
                        console.log("No pickaxe found in inventory.");
                        return;
                    }
                    bot.equip(pickaxe, 'hand', (err) => {
                        if (err) {
                            console.error(`Failed to equip pickaxe: ${err.message}`);
                            return;
                        }
                        console.log(`Equipped ${pickaxe.displayName}.`);
                        // Pathfind to the diamond ore block
                        bot.pathfinder.goto(new GoalNear(diamondOre.position.x, diamondOre.position.y, diamondOre.position.z, 1))
                            .then(() => {
                                // Dig the diamond ore block
                                return bot.dig(diamondOre);
                            })
                            .then(() => {
                                console.log(`Dug diamond ore at ${diamondOre.position}`);
                            })
                            .catch(err => {
                                console.error(`Failed to dig diamond ore: ${err.message}`);
                            });
                    });
                } else {
                    console.log("Usage: slave dirt   OR   slave diamonds");
                }

                // Only drop dirt after 'slave dirt' finishes digging
                if (itemName === 'dirt') {
                    bot.chat('/home drop');
                    setTimeout(async () => {
                        const dirtId = mcData.itemsByName.dirt.id;
                        const dirtItems = bot.inventory.items().filter(i => i.type === dirtId);
                        for (const item of dirtItems) {
                            await bot.tossStack(item);
                            console.log(`Dropped ${item.count}x dirt`);
                        }
                        console.log("All dirt dropped.");
                    }, 2000);
                }
        
    
    }else if (cmd === 'rotate') {
        // Usage: rotate <degrees>
        const degrees = parseFloat(args[1]);
        if (isNaN(degrees)) {
            console.log("Usage: rotate <degrees>");
            return;
        }
        const radians = degrees * (Math.PI / 180);
        const newYaw = bot.entity.yaw + radians;
        bot.look(newYaw, bot.entity.pitch, true, (err) => {
            if (err) {
                console.error(`Failed to rotate: ${err.message}`);
            } else {
                console.log(`Rotated to ${degrees} degrees.`);
            }
        });
     } else if (cmd === 'inv') {
        if (!bot.inventory || !bot.inventory.items()) {
            console.log("Inventory is empty or not available.");
            return;
        }
        const items = bot.inventory.items();
        if (items.length === 0) {
            console.log("Inventory is empty.");
        } else {
            items.forEach(item => {
                console.log(`${item.count}x ${item.displayName} (id: ${item.type})`);
            });
        }
      } else if (cmd === 'equip') {
        // Usage: equip <item_name>
        const itemName = args.slice(1).join(' ');
        if (!itemName) {
            console.log("Usage: equip <item_name>");
            return;
        }
        const item = bot.inventory.items().find(i => i.displayName.toLowerCase() === itemName.toLowerCase());
        if (!item) {
            console.log(`Item "${itemName}" not found in inventory.`);
            return;
        }
        bot.equip(item, 'hand', (err) => {
            if (err) {
                console.error(`Failed to equip item: ${err.message}`);
            } else {
                console.log(`Equipped ${item.displayName}.`);
            }});
        }
        else if (cmd === 'use') {
          // Usage: use <item_name>
          const itemName = args.slice(1).join(' ');
          if (!itemName) {
            console.log("Usage: use <item_name>");
            return;
          }
          const item = bot.inventory.items().find(i => i.displayName.toLowerCase() === itemName.toLowerCase());
          if (!item) {
            console.log(`Item "${itemName}" not found in inventory.`);
            return;
          }
          // If the item is armor, equip it to the correct slot
          const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
          const itemNameLower = item.name.toLowerCase();
          let destSlot = null;
          if (itemNameLower.includes('helmet')) destSlot = 'head';
          else if (itemNameLower.includes('chestplate')) destSlot = 'torso';
          else if (itemNameLower.includes('leggings')) destSlot = 'legs';
          else if (itemNameLower.includes('boots')) destSlot = 'feet';

          if (destSlot) {
            bot.equip(item, destSlot, (err) => {
                if (err) {
                  console.error(`Failed to wear armor: ${err.message}`);
                } else {
                  console.log(`Equipped ${item.displayName} as armor.`);
                }
            });
          } else {
            bot.equip(item, 'hand', (err) => {
                if (err) {
                  console.error(`Failed to equip item: ${err.message}`);
                } else {
                  bot.activateItem();
                  console.log(`Used ${item.displayName}.`);
                }
            });
          }
        }
        else if (cmd === 'drop') {
        // Usage: drop <item_name>
        const itemName = args.slice(1).join(' ');
        if (!itemName) {
            console.log("Usage: drop <item_name>");
            return;
        }
        const item = bot.inventory.items().find(i => i.displayName.toLowerCase() === itemName.toLowerCase());
        if (!item) {
            console.log(`Item "${itemName}" not found in inventory.`);
            return;
        }
        bot.tossStack(item, (err) => {
            if (err) {
                console.error(`Failed to drop item: ${err.message}`);
            } else {
                console.log(`Dropped ${item.displayName}.`);
            }
        });
      }
    else {
        console.log("Commands:\n goto <x> <y> <z>\n stop\n follow <username>\n stopfollow\n manhunt <username>\n killenemy <username>\n leave\n join\n chat <msg>\n pos\n jump\n end\n slave <dirt|diamonds>\n rotate <degrees>\n inv\n equip <item_name>\n use <item_name>\n drop <item_name>");
    }
      
}



rl.on('line', handleConsoleInput);
function main(){
    rl.question("ip: ", (ip) => {
        if (ip == "local")
        createBot('localhost:25565');

});
}
main();
// --- Start the bot ---

