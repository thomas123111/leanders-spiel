(() => {
    'use strict';

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const ui = {
        hud: document.getElementById('hud'),
        money: document.getElementById('money'),
        dayTime: document.getElementById('day-time'),
        customerTime: document.getElementById('customer-time'),
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
        drag: null,
        pointer: { down: false, x: 0, y: 0, movedAt: 0, startX: 0, startY: 0 },
        lastTime: performance.now(),
        messageTimer: 0,
        snow: Array.from({ length: 55 }, (_, i) => ({ x: (i * 173) % W, y: (i * 97) % H, r: 1 + (i % 3) }))
    };

    function randomOrder() {
        const keys = Object.keys(recipes);
        return keys[Math.floor(Math.random() * keys.length)];
    }

    function makeCustomer(index = 0) {
        const colors = ['#ffb45b', '#7bd1ff', '#cf8cff', '#8de08c', '#ff8d9d'];
        return { color: colors[(Math.floor(Math.random() * colors.length) + index) % colors.length] };
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
        game.drag = null;
        while (game.queue.length < 3) game.queue.push(makeCustomer(game.queue.length));
        updateUI();
    }

    function startDay() {
        game.mode = 'playing';
        game.money = 0;
        game.dayTime = DAY_SECONDS;
        game.queue = [makeCustomer(0), makeCustomer(1), makeCustomer(2)];
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

    function updateUI() {
        const recipe = recipes[game.order];
        ui.money.textContent = game.money;
        ui.dayTime.textContent = formatTime(game.dayTime);
        ui.customerTime.textContent = `0:${String(Math.max(0, Math.ceil(game.customerTime))).padStart(2, '0')}`;
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

        const station = ingredientStations.find(item => Math.hypot(x - item.x, y - item.y) < 48);
        if (!station) return;
        const recipe = recipes[game.order];
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
            const recipe = recipes[game.order];
            const allCollected = recipe.ingredients.every(name => game.collected.includes(name) || game.added.includes(name));
            setInstruction(allCollected ? 'Ziehe die Zutaten in die richtige Kochstelle.' : 'Tippe auf die nächste Zutat.');
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
        game.queue.shift();
        game.queue.push(makeCustomer(2));
        setInstruction(`Richtig! +${recipe.price} Euro`, 1.6);
        resetOrder();
    }

    function loseCustomer() {
        game.money = Math.max(0, game.money - 3);
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

        const slot = traySlots().find(item => hitRect(p.x, p.y, item));
        if (slot && game.mode === 'playing') {
            game.drag = { name: slot.name, x: p.x, y: p.y };
            return;
        }

        const tool = tools[recipes[game.order]?.tool];
        if (game.cooking && tool && hitRect(p.x, p.y, tool, 15)) return;
        clickWorld(p.x, p.y);
    });

    canvas.addEventListener('pointermove', event => {
        const p = canvasPoint(event);
        game.pointer.x = p.x;
        game.pointer.y = p.y;
        game.pointer.movedAt = performance.now();
        if (game.drag) {
            game.drag.x = p.x;
            game.drag.y = p.y;
        }
    });

    canvas.addEventListener('pointerup', event => {
        const p = canvasPoint(event);
        const recipe = recipes[game.order];
        const tool = recipe && tools[recipe.tool];

        if (game.drag && tool) {
            if (hitRect(p.x, p.y, tool, 25)) {
                const name = game.drag.name;
                game.collected = game.collected.filter(item => item !== name);
                if (!game.added.includes(name)) game.added.push(name);
                if (game.added.length === recipe.ingredients.length) {
                    game.cooking = true;
                    setInstruction(recipe.tool === 'bowl' ? 'Rühre den Salat 3 Sekunden lang.' : 'Wende das Essen dreimal nach oben.');
                } else {
                    setInstruction('Ziehe die nächste Zutat zur Kochstelle.');
                }
                updateUI();
            }
            game.drag = null;
        } else if (game.cooking && recipe?.tool === 'pan' && tool && hitRect(game.pointer.startX, game.pointer.startY, tool, 20)) {
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
        game.drag = null;
    });

    function completeCooking() {
        game.cooking = false;
        game.dishReady = true;
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
                setInstruction(game.collected.length || game.added.length ? 'Bereite die Bestellung zu.' : 'Tippe auf eine Zutat.');
            }
        }

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
        ctx.fillStyle = '#ffd14d';
        ctx.font = '900 14px Trebuchet MS';
        ctx.textAlign = 'center';
        ctx.fillText('ABHOLUNG', 878, 226);
    }

    function drawStations() {
        ctx.textAlign = 'center';
        ingredientStations.forEach(item => {
            roundedRect(item.x - 48, item.y - 42, 96, 84, 16, '#ffffff', '#69b8ce');
            ctx.font = '35px serif';
            ctx.fillText(item.emoji, item.x, item.y + 8);
            ctx.fillStyle = '#16465b';
            ctx.font = '900 12px Trebuchet MS';
            ctx.fillText(item.name, item.x, item.y + 31);
        });

        Object.entries(tools).forEach(([key, tool]) => {
            const active = recipes[game.order]?.tool === key;
            roundedRect(tool.x, tool.y, tool.w, tool.h, 18, active ? '#fff5c8' : '#d7e5e8', active ? '#ef9c27' : '#7b9ba5');
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
        if (game.drag) {
            ctx.globalAlpha = .82;
            ctx.font = '42px serif';
            ctx.fillText(ingredientEmoji(game.drag.name), game.drag.x, game.drag.y);
            ctx.globalAlpha = 1;
        }
    }

    function drawPenguin() {
        const p = game.player;
        ctx.save();
        ctx.translate(p.x, p.y);
        const bob = p.moving ? Math.sin(performance.now() / 85) * 4 : 0;
        ctx.translate(0, bob);
        ctx.fillStyle = '#10242f';
        ctx.beginPath(); ctx.ellipse(0, 4, 26, 36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, 11, 17, 25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffad32';
        ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(8, -10); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0c1720';
        ctx.beginPath(); ctx.arc(-8, -20, 3, 0, Math.PI * 2); ctx.arc(8, -20, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, -47, 25, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-18, -48, 36, 16);
        ctx.strokeStyle = '#b7dbe5'; ctx.lineWidth = 2; ctx.stroke();
        if (game.carryingDish) {
            ctx.font = '30px serif';
            ctx.textAlign = 'center';
            ctx.fillText(recipes[game.order].emoji, 0, -62);
        }
        ctx.restore();
    }

    function drawCustomers() {
        ctx.textAlign = 'center';
        game.queue.forEach((customer, index) => {
            const x = 865;
            const y = 285 + index * 86;
            ctx.fillStyle = customer.color;
            ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe0bd';
            ctx.beginPath(); ctx.arc(x, y - 17, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#17212b';
            ctx.beginPath(); ctx.arc(x - 5, y - 19, 2, 0, Math.PI * 2); ctx.arc(x + 5, y - 19, 2, 0, Math.PI * 2); ctx.fill();
            if (index === 0 && game.order) {
                roundedRect(808, y - 80, 64, 46, 14, '#fff', '#d5ecf2');
                ctx.font = '27px serif';
                ctx.fillText(recipes[game.order].emoji, 840, y - 47);
            }
        });
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
