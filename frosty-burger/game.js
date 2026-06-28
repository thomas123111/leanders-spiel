(() => {
    'use strict';

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const ui = {
        hud: document.getElementById('hud'),
        money: document.getElementById('money'),
        dayTime: document.getElementById('day-time'),
        customerTime: document.getElementById('customer-time'),
        orderCard: document.getElementById('order-card'),
        orderName: document.getElementById('order-name'),
        recipe: document.getElementById('recipe'),
        instruction: document.getElementById('instruction'),
        start: document.getElementById('start-screen'),
        result: document.getElementById('result-screen'),
        resultKicker: document.getElementById('result-kicker'),
        resultTitle: document.getElementById('result-title'),
        resultText: document.getElementById('result-text')
    };

    const W = canvas.width;
    const H = canvas.height;
    const DAY_SECONDS = 180;
    const CUSTOMER_SECONDS = 45;
    const TARGET_MONEY = 60;

    const recipes = {
        burger: { name: 'Burger', emoji: '🍔', price: 10, tool: 'pan', ingredients: ['Brötchen', 'Fleisch', 'Käse'] },
        salad: { name: 'Salat', emoji: '🥗', price: 15, tool: 'bowl', ingredients: ['Salat', 'Tomate', 'Gurke'] },
        meat: { name: 'Fleischgericht', emoji: '🥩', price: 30, tool: 'pan', ingredients: ['Fleisch', 'Kartoffel', 'Soße'] }
    };

    const ingredientStations = [
        { name: 'Brötchen', emoji: '🥯', x: 120, y: 130 },
        { name: 'Fleisch', emoji: '🥩', x: 250, y: 130 },
        { name: 'Käse', emoji: '🧀', x: 380, y: 130 },
        { name: 'Salat', emoji: '🥬', x: 510, y: 130 },
        { name: 'Tomate', emoji: '🍅', x: 120, y: 385 },
        { name: 'Gurke', emoji: '🥒', x: 250, y: 385 },
        { name: 'Kartoffel', emoji: '🥔', x: 380, y: 385 },
        { name: 'Soße', emoji: '🫙', x: 510, y: 385 }
    ];

    const tools = {
        pan: { x: 630, y: 210, w: 130, h: 100, name: 'Pfanne' },
        bowl: { x: 630, y: 340, w: 130, h: 100, name: 'Schüssel' }
    };

    const game = {
        mode: 'title',
        money: 0,
        dayTime: DAY_SECONDS,
        customerTime: CUSTOMER_SECONDS,
        order: null,
        queue: [],
        collected: [],
        added: [],
        dishReady: false,
        carryingDish: false,
        cooking: false,
        stirTime: 0,
        flips: 0,
        player: { x: 450, y: 265, targetX: 450, targetY: 265, moving: false, task: null },
        pointer: { down: false, x: 0, y: 0, movedAt: 0, startX: 0, startY: 0 },
        lastTime: performance.now(),
        messageTimer: 0,
        effects: [],
        audio: null,
        snow: Array.from({ length: 55 }, (_, i) => ({ x: (i * 173) % W, y: (i * 97) % H, r: 1 + (i % 3) }))
    };

    function initAudio() {
        if (game.audio || typeof window === 'undefined') return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) game.audio = new AudioContext();
    }

    function tone(frequency, duration = 0.08, type = 'sine') {
        if (!game.audio) return;
        const oscillator = game.audio.createOscillator();
        const gain = game.audio.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.08, game.audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, game.audio.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(game.audio.destination);
        oscillator.start();
        oscillator.stop(game.audio.currentTime + duration);
    }

    function addEffect(text, x, y, color = '#ffffff') {
        game.effects.push({ text, x, y, color, life: 1.2, maxLife: 1.2 });
    }

    function randomOrder() {
        const keys = Object.keys(recipes);
        return keys[Math.floor(Math.random() * keys.length)];
    }

    function makeCustomer(index = 0) {
        const colors = ['#ffb45b', '#7bd1ff', '#cf8cff', '#8de08c', '#ff8d9d'];
        const hair = ['#5b331f', '#231a18', '#d68b27', '#7c5239'];
        return {
            color: colors[(Math.floor(Math.random() * colors.length) + index) % colors.length],
            hair: hair[(Math.floor(Math.random() * hair.length) + index) % hair.length],
            style: (Math.floor(Math.random() * 3) + index) % 3
        };
    }

    function resetOrder() {
        game.order = randomOrder();
        game.customerTime = CUSTOMER_SECONDS;
        game.collected = [];
        game.added = [];
        game.dishReady = false;
        game.carryingDish = false;
        game.cooking = false;
        game.stirTime = 0;
        game.flips = 0;
        while (game.queue.length < 3) game.queue.push(makeCustomer(game.queue.length));
        updateUI();
    }

    function startDay() {
        initAudio();
        game.audio?.resume?.();
        game.mode = 'playing';
        game.money = 0;
        game.dayTime = DAY_SECONDS;
        game.queue = [makeCustomer(0), makeCustomer(1), makeCustomer(2)];
        game.effects = [];
        Object.assign(game.player, { x: 450, y: 265, targetX: 450, targetY: 265, moving: false, task: null });
        ui.start.classList.add('hidden');
        ui.result.classList.add('hidden');
        ui.hud.classList.remove('hidden');
        resetOrder();
        setInstruction('Tippe auf die erste Zutat.');
    }

    function finishDay() {
        game.mode = 'result';
        ui.hud.classList.add('hidden');
        ui.result.classList.remove('hidden');
        const won = game.money >= TARGET_MONEY;
        ui.resultKicker.textContent = won ? 'TAG 1 GESCHAFFT' : 'FEIERABEND';
        ui.resultTitle.textContent = won ? 'SUPER!' : 'FAST!';
        ui.resultText.textContent = won
            ? `Du hast ${game.money} Euro verdient. Frosty ist ein Küchen-Profi!`
            : `Du hast ${game.money} Euro verdient. Für das Ziel fehlen noch ${TARGET_MONEY - game.money} Euro.`;
    }

    function setInstruction(text, seconds = 0) {
        ui.instruction.textContent = text;
        game.messageTimer = seconds;
    }

    function nextInstruction() {
        if (!game.order) return 'Tippe auf eine Zutat.';
        const recipe = recipes[game.order];
        if (game.carryingDish) return 'Tippe auf den ersten Kunden rechts.';
        if (game.dishReady) return 'Tippe auf die fertige Kochstelle.';
        if (game.cooking) return recipe.tool === 'bowl' ? 'Rühre den Salat um.' : 'Wende das Essen nach oben.';
        const allCollected = recipe.ingredients.every(name => game.collected.includes(name));
        if (allCollected) return `Tippe auf die ${tools[recipe.tool].name}.`;
        return game.collected.length ? 'Tippe auf die nächste Zutat.' : 'Tippe auf eine Zutat.';
    }

    function updateUI() {
        const recipe = recipes[game.order];
        ui.money.textContent = game.money;
        ui.dayTime.textContent = formatTime(game.dayTime);
        ui.customerTime.textContent = `0:${String(Math.max(0, Math.ceil(game.customerTime))).padStart(2, '0')}`;
        ui.orderCard.classList.remove('warning', 'danger');
        if (game.customerTime <= 10) ui.orderCard.classList.add('danger');
        else if (game.customerTime <= 20) ui.orderCard.classList.add('warning');
        ui.orderName.textContent = `${recipe.emoji} ${recipe.name} · ${recipe.price} €`;
        ui.recipe.innerHTML = recipe.ingredients.map(name => {
            const done = game.collected.includes(name) || game.added.includes(name);
            return `<span class="recipe-item ${done ? 'done' : ''}">${ingredientEmoji(name)} ${name}</span>`;
        }).join('');
    }

    function formatTime(value) {
        const seconds = Math.max(0, Math.ceil(value));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }

    function ingredientEmoji(name) {
        return ingredientStations.find(item => item.name === name)?.emoji || '•';
    }

    function canvasPoint(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * W / rect.width,
            y: (event.clientY - rect.top) * H / rect.height
        };
    }

    function hitRect(x, y, rect, padding = 0) {
        return x >= rect.x - padding && x <= rect.x + rect.w + padding && y >= rect.y - padding && y <= rect.y + rect.h + padding;
    }

    function setPlayerTarget(x, y, task) {
        game.player.targetX = x;
        game.player.targetY = y;
        game.player.task = task;
        game.player.moving = true;
    }

    function clickWorld(x, y) {
        if (game.mode !== 'playing') return;

        if (game.player.moving) {
            setInstruction('Frosty ist schon unterwegs.', 0.8);
            return;
        }

        if (game.dishReady && hitRect(x, y, tools[recipes[game.order].tool], 20)) {
            const tool = tools[recipes[game.order].tool];
            setPlayerTarget(tool.x + tool.w / 2, tool.y + tool.h + 18, { type: 'pickupDish' });
            setInstruction('Frosty holt das fertige Essen.');
            return;
        }

        if (game.carryingDish && x > 790) {
            setPlayerTarget(790, 280, { type: 'serve' });
            setInstruction('Frosty serviert dem Kunden.');
            return;
        }

        const recipe = recipes[game.order];
        const activeTool = tools[recipe.tool];
        const touchedTool = Object.values(tools).find(tool => hitRect(x, y, tool, 30));
        if (touchedTool) {
            if (touchedTool !== activeTool) {
                setInstruction(`Für ${recipe.name} brauchst du die ${activeTool.name}.`, 1.5);
                return;
            }
            const allCollected = recipe.ingredients.every(name => game.collected.includes(name));
            if (!allCollected) {
                const missing = recipe.ingredients.length - game.collected.length;
                setInstruction(`Es ${missing === 1 ? 'fehlt' : 'fehlen'} noch ${missing} ${missing === 1 ? 'Zutat' : 'Zutaten'}.`, 1.3);
                return;
            }
            setPlayerTarget(activeTool.x + activeTool.w / 2, activeTool.y + activeTool.h + 18, { type: 'placeIngredients' });
            setInstruction(`Frosty bringt alles zur ${activeTool.name}.`);
            return;
        }

        const station = ingredientStations.find(item => Math.hypot(x - item.x, y - item.y) < 58);
        if (!station) return;
        const needed = recipe.ingredients.filter(name => !game.collected.includes(name) && !game.added.includes(name));
        if (!needed.includes(station.name)) {
            setInstruction('Diese Zutat gehört nicht zur Bestellung.', 1.5);
            return;
        }
        setPlayerTarget(station.x, station.y + (station.y < H / 2 ? 62 : -62), { type: 'pickupIngredient', name: station.name });
        setInstruction(`Frosty holt ${station.name}.`);
    }

    function finishTask(task) {
        if (!task) return;
        if (task.type === 'pickupIngredient') {
            if (!game.collected.includes(task.name)) game.collected.push(task.name);
            tone(660, 0.08, 'triangle');
            addEffect(`+ ${ingredientEmoji(task.name)}`, game.player.x, game.player.y - 42, '#0a7899');
            const recipe = recipes[game.order];
            const allCollected = recipe.ingredients.every(name => game.collected.includes(name) || game.added.includes(name));
            const toolName = tools[recipe.tool].name;
            setInstruction(allCollected ? `Alle Zutaten da! Tippe auf die ${toolName}.` : 'Tippe auf die nächste Zutat.');
        } else if (task.type === 'placeIngredients') {
            const recipe = recipes[game.order];
            game.added = [...recipe.ingredients];
            game.collected = [];
            game.cooking = true;
            tone(520, 0.1, 'triangle');
            addEffect('ALLES DRIN!', game.player.x, game.player.y - 46, '#d86b13');
            setInstruction(recipe.tool === 'bowl' ? 'Rühre den Salat 3 Sekunden lang.' : 'Wende das Essen dreimal nach oben.');
        } else if (task.type === 'pickupDish') {
            game.dishReady = false;
            game.carryingDish = true;
            setInstruction('Tippe auf den ersten Kunden rechts.');
        } else if (task.type === 'serve') {
            serveCustomer();
        }
        updateUI();
    }

    function serveCustomer() {
        const recipe = recipes[game.order];
        game.money += recipe.price;
        tone(880, 0.12, 'triangle');
        if (game.audio) setTimeout(() => tone(1175, 0.14, 'triangle'), 80);
        addEffect(`+${recipe.price} €`, 830, 245, '#147a4f');
        game.queue.shift();
        game.queue.push(makeCustomer(2));
        setInstruction(`Richtig! +${recipe.price} Euro`, 1.6);
        resetOrder();
    }

    function loseCustomer() {
        game.money = Math.max(0, game.money - 3);
        tone(170, 0.22, 'sawtooth');
        addEffect('−3 €', 830, 245, '#d73e3e');
        game.queue.shift();
        game.queue.push(makeCustomer(2));
        setInstruction('Der Kunde ist gegangen. −3 Euro', 1.8);
        resetOrder();
    }

    function traySlots() {
        return game.collected.map((name, i) => ({ name, x: 330 + i * 82, y: 40, w: 70, h: 54 }));
    }

    canvas.addEventListener('pointerdown', event => {
        const p = canvasPoint(event);
        game.pointer = { down: true, x: p.x, y: p.y, movedAt: performance.now(), startX: p.x, startY: p.y };
        canvas.setPointerCapture?.(event.pointerId);

        const tool = tools[recipes[game.order]?.tool];
        if (game.cooking && tool && hitRect(p.x, p.y, tool, 15)) return;
        clickWorld(p.x, p.y);
    });

    canvas.addEventListener('pointermove', event => {
        const p = canvasPoint(event);
        game.pointer.x = p.x;
        game.pointer.y = p.y;
        game.pointer.movedAt = performance.now();
    });

    canvas.addEventListener('pointerup', event => {
        const p = canvasPoint(event);
        const recipe = recipes[game.order];
        const tool = recipe && tools[recipe.tool];

        if (game.cooking && recipe?.tool === 'pan' && tool && hitRect(game.pointer.startX, game.pointer.startY, tool, 20)) {
            const dy = p.y - game.pointer.startY;
            if (dy < -45) {
                game.flips++;
                setInstruction(`Gewendet: ${game.flips}/3`);
                if (game.flips >= 3) completeCooking();
            }
        }

        game.pointer.down = false;
    });

    canvas.addEventListener('pointercancel', () => {
        game.pointer.down = false;
    });

    function completeCooking() {
        game.cooking = false;
        game.dishReady = true;
        tone(740, 0.1, 'triangle');
        addEffect('FERTIG!', 695, recipes[game.order].tool === 'pan' ? 205 : 335, '#d86b13');
        setInstruction('Fertig! Tippe auf die Kochstelle.');
    }

    function update(dt) {
        if (game.mode !== 'playing') return;
        game.dayTime -= dt;
        game.customerTime -= dt;
        if (game.dayTime <= 0) {
            finishDay();
            return;
        }
        if (game.customerTime <= 0) {
            loseCustomer();
        }

        if (game.messageTimer > 0) {
            game.messageTimer -= dt;
            if (game.messageTimer <= 0) {
                setInstruction(nextInstruction());
            }
        }

        for (const effect of game.effects) {
            effect.life -= dt;
            effect.y -= 24 * dt;
        }
        game.effects = game.effects.filter(effect => effect.life > 0);

        const player = game.player;
        if (player.moving) {
            const dx = player.targetX - player.x;
            const dy = player.targetY - player.y;
            const distance = Math.hypot(dx, dy);
            const step = 230 * dt;
            if (distance <= step) {
                player.x = player.targetX;
                player.y = player.targetY;
                player.moving = false;
                const task = player.task;
                player.task = null;
                finishTask(task);
            } else {
                player.x += dx / distance * step;
                player.y += dy / distance * step;
            }
        }

        const recipe = recipes[game.order];
        const tool = recipe && tools[recipe.tool];
        if (game.cooking && recipe.tool === 'bowl' && game.pointer.down && tool && hitRect(game.pointer.x, game.pointer.y, tool, 12)) {
            if (performance.now() - game.pointer.movedAt < 180) {
                game.stirTime = Math.min(3, game.stirTime + dt);
                setInstruction(`Umrühren: ${game.stirTime.toFixed(1)}/3 Sekunden`);
                if (game.stirTime >= 3) completeCooking();
            }
        }
        updateUI();
    }

    function roundedRect(x, y, w, h, radius, fill, stroke) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
    }

    function drawBackground() {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#8ce7ff');
        sky.addColorStop(1, '#dffaff');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#f6fdff';
        ctx.beginPath();
        ctx.moveTo(0, 190); ctx.lineTo(100, 95); ctx.lineTo(190, 190);
        ctx.lineTo(285, 80); ctx.lineTo(410, 190); ctx.lineTo(510, 110);
        ctx.lineTo(640, 190); ctx.lineTo(760, 90); ctx.lineTo(890, 190); ctx.lineTo(960, 120);
        ctx.lineTo(960, 250); ctx.lineTo(0, 250); ctx.closePath(); ctx.fill();

        roundedRect(34, 88, 752, 412, 28, '#f3fbff', '#1b7495');

        ctx.fillStyle = '#0c6685';
        ctx.fillRect(54, 104, 712, 42);
        ctx.fillStyle = '#84d7e8';
        for (let x = 78; x < 750; x += 86) {
            roundedRect(x, 112, 58, 24, 8, '#bcefff', '#4fa8bc');
            ctx.fillStyle = 'rgba(255,255,255,.7)';
            ctx.fillRect(x + 8, 118, 20, 4);
        }
        ctx.fillStyle = '#d7edf1';
        for (let y = 170; y < 500; y += 58) {
            for (let x = 52; x < 770; x += 58) {
                ctx.fillRect(x, y, 54, 54);
            }
        }
        ctx.fillStyle = '#eaf8fb';
        for (let y = 170; y < 500; y += 116) {
            for (let x = 52; x < 770; x += 116) ctx.fillRect(x, y, 54, 54);
        }

        ctx.fillStyle = '#0b5975';
        ctx.fillRect(785, 0, 175, H);
        ctx.fillStyle = '#eafcff';
        ctx.fillRect(785, 205, 20, 145);
        ctx.fillStyle = '#06384f';
        ctx.fillRect(805, 205, 155, 145);
        ctx.fillStyle = '#89c8d8';
        ctx.fillRect(815, 350, 135, 9);
        ctx.fillStyle = '#d4f5fb';
        ctx.beginPath();
        ctx.arc(830, 365, 7, 0, Math.PI * 2);
        ctx.arc(930, 365, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd14d';
        ctx.font = '900 14px Trebuchet MS';
        ctx.textAlign = 'center';
        ctx.fillText('ABHOLUNG', 878, 226);
    }

    function drawStations() {
        ctx.textAlign = 'center';
        const recipe = recipes[game.order];
        const pulse = 0.5 + Math.sin(performance.now() / 180) * 0.5;
        ingredientStations.forEach(item => {
            const needed = recipe?.ingredients.includes(item.name) && !game.collected.includes(item.name) && !game.added.includes(item.name);
            ctx.save();
            if (needed && !game.player.moving) {
                ctx.shadowColor = '#ffd84b';
                ctx.shadowBlur = 16 + pulse * 10;
            }
            roundedRect(item.x - 50, item.y - 44, 100, 88, 17, needed ? '#fff9d9' : '#ffffff', needed ? '#efad28' : '#69b8ce');
            ctx.restore();
            ctx.font = '35px serif';
            ctx.fillText(item.emoji, item.x, item.y + 8);
            ctx.fillStyle = '#16465b';
            ctx.font = '900 12px Trebuchet MS';
            ctx.fillText(item.name, item.x, item.y + 31);
            if (needed && !game.player.moving) {
                ctx.fillStyle = '#9b5600';
                ctx.font = '900 9px Trebuchet MS';
                ctx.fillText('TIPPE', item.x, item.y - 31);
            }
        });

        Object.entries(tools).forEach(([key, tool]) => {
            const active = recipes[game.order]?.tool === key;
            const wantsIngredients = active && (game.collected.length > 0 || game.added.length > 0) && !game.dishReady;
            ctx.save();
            if (wantsIngredients || game.dishReady) {
                ctx.shadowColor = game.dishReady ? '#43db83' : '#ffb72e';
                ctx.shadowBlur = 16 + pulse * 10;
            }
            roundedRect(tool.x, tool.y, tool.w, tool.h, 18, active ? '#fff5c8' : '#d7e5e8', active ? '#ef9c27' : '#7b9ba5');
            ctx.restore();
            ctx.font = '42px serif';
            ctx.fillText(key === 'pan' ? '🍳' : '🥣', tool.x + tool.w / 2, tool.y + 55);
            ctx.fillStyle = '#16465b';
            ctx.font = '900 13px Trebuchet MS';
            ctx.fillText(tool.name, tool.x + tool.w / 2, tool.y + 84);
            if (active && game.added.length) {
                ctx.fillStyle = '#087fa8';
                ctx.font = '900 12px Trebuchet MS';
                ctx.fillText(`${game.added.length}/3`, tool.x + 18, tool.y + 20);
            }
            if (active && game.dishReady) {
                ctx.font = '38px serif';
                ctx.fillText(recipes[game.order].emoji, tool.x + tool.w / 2, tool.y + 50);
            }
            if (active && game.cooking) {
                ctx.fillStyle = '#9b5600';
                ctx.font = '900 10px Trebuchet MS';
                ctx.fillText(key === 'pan' ? 'NACH OBEN WISCHEN' : 'KREISEN', tool.x + tool.w / 2, tool.y - 9);
            }
        });
    }

    function drawTray() {
        traySlots().forEach(slot => {
            roundedRect(slot.x, slot.y, slot.w, slot.h, 13, '#fff', '#2798bc');
            ctx.font = '24px serif';
            ctx.textAlign = 'center';
            ctx.fillText(ingredientEmoji(slot.name), slot.x + slot.w / 2, slot.y + 28);
            ctx.fillStyle = '#16465b';
            ctx.font = '800 9px Trebuchet MS';
            ctx.fillText(slot.name, slot.x + slot.w / 2, slot.y + 45);
        });
    }

    function drawPenguin() {
        const p = game.player;
        ctx.save();
        ctx.translate(p.x, p.y);
        const bob = p.moving ? Math.sin(performance.now() / 85) * 4 : 0;
        ctx.translate(0, bob);
        ctx.fillStyle = 'rgba(2,31,44,.22)';
        ctx.beginPath(); ctx.ellipse(0, 38, 30, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#10242f';
        ctx.save();
        ctx.rotate(p.moving ? Math.sin(performance.now() / 95) * .18 : -.12);
        ctx.beginPath(); ctx.ellipse(-27, 4, 10, 27, -.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.rotate(p.moving ? -Math.sin(performance.now() / 95) * .18 : .12);
        ctx.beginPath(); ctx.ellipse(27, 4, 10, 27, .2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#10242f';
        ctx.beginPath(); ctx.ellipse(0, 4, 26, 36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, 11, 17, 25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffad32';
        ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(8, -10); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-13, 36, 13, 6, -.12, 0, Math.PI * 2); ctx.ellipse(13, 36, 13, 6, .12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0c1720';
        ctx.beginPath(); ctx.arc(-8, -20, 3, 0, Math.PI * 2); ctx.arc(8, -20, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, -47, 25, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-18, -48, 36, 16);
        ctx.beginPath();
        ctx.arc(-14, -55, 12, Math.PI, 0);
        ctx.arc(0, -60, 13, Math.PI, 0);
        ctx.arc(14, -55, 12, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#b7dbe5'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-18, -32); ctx.lineTo(18, -32); ctx.stroke();
        if (game.carryingDish) {
            ctx.font = '30px serif';
            ctx.textAlign = 'center';
            ctx.fillText(recipes[game.order].emoji, 0, -62);
        }
        ctx.restore();
    }

    function drawCustomers() {
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#b9ecf6';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(815, 310); ctx.lineTo(815, 505);
        ctx.moveTo(925, 310); ctx.lineTo(925, 505);
        ctx.stroke();
        game.queue.forEach((customer, index) => {
            const x = 865;
            const y = 285 + index * 86;
            ctx.fillStyle = customer.color;
            ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe0bd';
            ctx.beginPath(); ctx.arc(x, y - 17, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = customer.hair;
            if (customer.style === 0) {
                ctx.beginPath(); ctx.arc(x, y - 24, 15, Math.PI, Math.PI * 2); ctx.fill();
            } else if (customer.style === 1) {
                ctx.fillRect(x - 16, y - 31, 32, 8);
                ctx.fillRect(x + 10, y - 28, 8, 17);
            } else {
                ctx.beginPath();
                ctx.arc(x - 9, y - 29, 7, 0, Math.PI * 2);
                ctx.arc(x, y - 31, 8, 0, Math.PI * 2);
                ctx.arc(x + 9, y - 29, 7, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#17212b';
            ctx.beginPath(); ctx.arc(x - 5, y - 19, 2, 0, Math.PI * 2); ctx.arc(x + 5, y - 19, 2, 0, Math.PI * 2); ctx.fill();
            if (index === 0 && game.order) {
                roundedRect(808, y - 88, 64, 50, 14, '#fff', '#d5ecf2');
                ctx.font = '27px serif';
                ctx.fillText(recipes[game.order].emoji, 840, y - 53);
                const patience = Math.max(0, game.customerTime / CUSTOMER_SECONDS);
                ctx.fillStyle = '#dce9ec';
                ctx.fillRect(810, y + 35, 110, 9);
                ctx.fillStyle = patience > .45 ? '#37bd77' : patience > .22 ? '#ffb72e' : '#ef4e4e';
                ctx.fillRect(810, y + 35, 110 * patience, 9);
            }
        });
    }

    function drawEffects() {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '900 22px Trebuchet MS';
        for (const effect of game.effects) {
            ctx.globalAlpha = Math.min(1, effect.life * 2);
            ctx.fillStyle = effect.color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.strokeText(effect.text, effect.x, effect.y);
            ctx.fillText(effect.text, effect.x, effect.y);
        }
        ctx.restore();
    }

    function drawCookingProgress() {
        if (!game.cooking) return;
        const recipe = recipes[game.order];
        const tool = tools[recipe.tool];
        const progress = recipe.tool === 'bowl' ? game.stirTime / 3 : game.flips / 3;
        ctx.strokeStyle = '#d5e3e8'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(tool.x + tool.w / 2, tool.y + tool.h / 2, 48, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
        ctx.strokeStyle = '#24b97b';
        ctx.beginPath(); ctx.arc(tool.x + tool.w / 2, tool.y + tool.h / 2, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
    }

    function render() {
        drawBackground();
        drawStations();
        drawCustomers();
        drawPenguin();
        drawTray();
        drawCookingProgress();
        drawEffects();

        game.snow.forEach(flake => {
            flake.y += .18;
            if (flake.y > H) flake.y = 0;
            ctx.fillStyle = 'rgba(255,255,255,.7)';
            ctx.beginPath(); ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2); ctx.fill();
        });
    }

    function loop(now) {
        const dt = Math.min(.05, (now - game.lastTime) / 1000);
        game.lastTime = now;
        update(dt);
        render();
        requestAnimationFrame(loop);
    }

    document.getElementById('start-button').addEventListener('click', startDay);
    document.getElementById('restart-button').addEventListener('click', startDay);
    requestAnimationFrame(loop);
})();
