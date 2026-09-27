// ── World 13-15 Enemies ──

// W13: Skelett-Bogenschütze
class SkeletonArcher extends Enemy {
    constructor(x,y) {
        super(x,y,22,24); this.hp=5; this.maxHp=5; this.speed=35; this.damage=1;
        this.detectionRange=220; this.shootTimer=0; this.shootCooldown=2;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange){
            const a=angleBetween(mc,pc);
            if(dist>100) this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
            this.shootTimer-=dt;
            if(this.shootTimer<=0&&typeof Game!=='undefined'){
                this.shootTimer=this.shootCooldown;
                Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(a)*170,Math.sin(a)*170,1,'enemy',50));
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();
            for(let i=0;i<6;i++){ctx.globalAlpha=(1-t);ctx.fillStyle='#EEE';
                ctx.fillRect(cx+Math.cos(i)*t*25-2,cy+Math.sin(i*1.2)*t*25-2,4,3);}
            ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        ctx.fillStyle='#EEE';ctx.beginPath();ctx.arc(cx,cy-6,7,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#DDD';ctx.fillRect(cx-5,cy,10,12);
        ctx.fillStyle='#000';ctx.beginPath();ctx.arc(cx-3,cy-7,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+3,cy-7,2,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#A86';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx+6,cy-2);ctx.lineTo(cx+14,cy-10);ctx.stroke();
        ctx.restore();
    }
}

// W13: Bumerang-Skelett (Schlüsselwächter)
class BoomerangSkeleton extends Enemy {
    constructor(x,y) {
        super(x,y,26,26); this.hp=10; this.maxHp=10; this.speed=30; this.damage=2;
        this.detectionRange=200; this.throwTimer=0; this.throwCooldown=3;
        this.isKeyGhost=true; this.droppedKey=false;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange){
            const a=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
            this.throwTimer-=dt;
            if(this.throwTimer<=0&&typeof Game!=='undefined'){
                this.throwTimer=this.throwCooldown;
                const p=new Projectile(mc.x,mc.y,Math.cos(a)*140,Math.sin(a)*140,2,'enemy',80);
                p.bouncesLeft=2; p.lifetime=4;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();
            for(let i=0;i<8;i++){ctx.globalAlpha=(1-t);ctx.fillStyle='#0F0';
                ctx.fillRect(cx+Math.cos(i)*t*30-2,cy+Math.sin(i*1.1)*t*30-2,4,3);}
            ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        ctx.globalAlpha=0.2+Math.sin(Date.now()/300)*0.1;ctx.fillStyle='#0F0';
        ctx.beginPath();ctx.arc(cx,cy,18,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=this.isFlashing()?0.4:1;
        ctx.fillStyle='#EEE';ctx.beginPath();ctx.arc(cx,cy-6,8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#DDD';ctx.fillRect(cx-6,cy,12,13);
        ctx.fillStyle='#0F0';ctx.beginPath();ctx.arc(cx-3,cy-7,2.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+3,cy-7,2.5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#FFD700';ctx.fillRect(cx-3,cy+2,6,4);
        ctx.restore();
    }
}

// W13 Boss: KNOCHEN-REITER
class BossSkeletonRider extends Enemy {
    constructor(x,y) {
        super(x,y,100,80); this.hp=60; this.maxHp=60; this.speed=35;
        this.damage=3; this.isBoss=true; this.contactDamage=false;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.chargeTimer=4; this.charging=false; this.chargeDir={x:0,y:0};
        this.chargeProgress=0; this.phase=1;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return;
        if(this.hp<=30&&this.phase===1){this.phase=2;this.speed=50;this.chargeTimer=0.5;}
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='chase';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='chase';return;}
        if(this.state==='charge'){
            this.chargeProgress+=dt;
            this.x+=this.chargeDir.x*300*dt;this.y+=this.chargeDir.y*300*dt;
            if(typeof Game!=='undefined')Game.camera.shake(3,0.1);
            if(vecDist(mc,pc)<60){player.takeDamage(3,angleBetween(mc,pc),300);
                if(particles)for(let i=0;i<6;i++)particles.push(new Particle(pc.x,pc.y,randRange(-60,60),randRange(-60,60),'#EEE',0.4));}
            if(this.chargeProgress>1){this.state='stunned';this.stunnedTimer=2.5;}
            return;
        }
        const a=angleBetween(mc,pc);
        this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
        this.chargeTimer-=dt;
        if(this.chargeTimer<=0){this.chargeTimer=this.phase===1?4:2.5;
            this.state='charge';this.chargeDir=vecNormalize(vecSub(pc,mc));this.chargeProgress=0;}
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();
            for(let i=0;i<20;i++){ctx.globalAlpha=(1-t)*0.8;ctx.fillStyle='#EEE';
                const a=(Math.PI*2*i)/20+t*3;
                ctx.fillRect(cx+Math.cos(a)*t*70-3,cy+Math.sin(a)*t*70-2,6,4);}
            ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        // Horse body
        ctx.fillStyle='#EEE';ctx.beginPath();ctx.ellipse(cx,cy+10,35,18,0,0,Math.PI*2);ctx.fill();
        // Horse legs
        ctx.fillStyle='#DDD';
        ctx.fillRect(cx-25,cy+22,5,16);ctx.fillRect(cx-12,cy+22,5,16);
        ctx.fillRect(cx+8,cy+22,5,16);ctx.fillRect(cx+20,cy+22,5,16);
        // Horse head
        ctx.fillStyle='#EEE';ctx.beginPath();ctx.ellipse(cx+30,cy-5,12,8,0.5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#F00';ctx.beginPath();ctx.arc(cx+35,cy-8,3,0,Math.PI*2);ctx.fill();
        // Rider body
        ctx.fillStyle='#DDD';ctx.fillRect(cx-8,cy-20,16,22);
        // Rider head (skull)
        ctx.fillStyle='#EEE';ctx.beginPath();ctx.arc(cx,cy-28,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#000';ctx.beginPath();ctx.arc(cx-4,cy-30,3,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+4,cy-30,3,0,Math.PI*2);ctx.fill();
        ctx.fillRect(cx-3,cy-24,6,3);
        // Sword
        ctx.strokeStyle='#CCC';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx+8,cy-15);ctx.lineTo(cx+25,cy-30);ctx.stroke();
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='14px monospace';
            for(let i=0;i<4;i++){const sa=Date.now()/250+i*Math.PI/2;ctx.fillText('\u2605',cx+Math.cos(sa)*40,pos.y-35+Math.sin(sa)*6);}}
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';
        ctx.fillText('KNOCHEN-REITER',cx,pos.y-40);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-45,pos.y-35,90,7,3);ctx.fill();
        ctx.fillStyle=this.hp>25?'#EEE':'#F00';ctx.beginPath();ctx.roundRect(cx-44,pos.y-34,88*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}

// W14: Giftschlange
class PoisonSnake extends Enemy {
    constructor(x,y) {
        super(x,y,18,14); this.hp=3; this.maxHp=3; this.speed=70; this.damage=1;
        this.detectionRange=150; this.spitTimer=0; this.spitCooldown=2.5;
        this.slither=0;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return; this.slither+=dt*8;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange){
            const a=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
            this.spitTimer-=dt;
            if(this.spitTimer<=0&&typeof Game!=='undefined'&&dist<100){
                this.spitTimer=this.spitCooldown;
                const p=new Projectile(mc.x,mc.y,Math.cos(a)*130,Math.sin(a)*130,1,'enemy',40);
                p.poison=true;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#4F4';
            ctx.beginPath();ctx.arc(cx,cy,7*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        const sw=Math.sin(this.slither)*3;
        ctx.fillStyle='#4A4';ctx.beginPath();
        ctx.moveTo(cx-8+sw,cy);ctx.quadraticCurveTo(cx,cy-5-sw,cx+8-sw,cy);
        ctx.quadraticCurveTo(cx,cy+5+sw,cx-8+sw,cy);ctx.fill();
        ctx.fillStyle='#6C6';ctx.beginPath();ctx.arc(cx+6,cy-2,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#F00';ctx.beginPath();ctx.arc(cx+5,cy-3,1.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+8,cy-3,1.5,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
}

// W14 Boss: HYDRA (7-Kopf-Schlange)
class BossHydra extends Enemy {
    constructor(x,y) {
        super(x,y,110,90); this.hp=65; this.maxHp=65; this.speed=20;
        this.damage=2; this.isBoss=true; this.contactDamage=false;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.rainTimer=4; this.phase=1; this.headCount=7;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return;
        if(this.hp<=33&&this.phase===1){this.phase=2;this.speed=30;}
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='chase';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='chase';return;}
        const a=angleBetween(mc,pc);
        this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
        this.rainTimer-=dt;
        if(this.rainTimer<=0){this.rainTimer=this.phase===1?4:2.5;
            for(let i=0;i<this.headCount;i++){const ha=(Math.PI*2*i)/this.headCount;
                if(typeof Game!=='undefined')Game.projectiles.push(new Projectile(mc.x+Math.cos(ha)*30,mc.y+Math.sin(ha)*30,Math.cos(ha)*100+(pc.x-mc.x)*0.3,Math.sin(ha)*100+(pc.y-mc.y)*0.3,1,'enemy',40));}
            if(particles)for(let i=0;i<8;i++)particles.push(new Particle(mc.x,mc.y,randRange(-50,50),randRange(-50,50),'#4F4',0.5));
            this.state='stunned';this.stunnedTimer=2;}
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t)*0.8;ctx.fillStyle='#4A4';
            ctx.beginPath();ctx.ellipse(cx,cy,50*(1-t*0.5),30*(1-t*0.5),0,0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        ctx.fillStyle='#3A6A3A';ctx.beginPath();ctx.ellipse(cx,cy+10,45,28,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#4A8A4A';
        for(let i=0;i<this.headCount;i++){
            const ha=(Math.PI*2*i)/this.headCount;const hx=cx+Math.cos(ha)*35;const hy=cy-20+Math.sin(ha+Date.now()/500)*8;
            ctx.beginPath();ctx.moveTo(cx+Math.cos(ha)*15,cy);ctx.quadraticCurveTo(cx+Math.cos(ha)*25,hy+10,hx,hy);ctx.lineWidth=4;ctx.strokeStyle='#3A6A3A';ctx.stroke();
            ctx.fillStyle='#4A8A4A';ctx.beginPath();ctx.arc(hx,hy,7,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#F00';ctx.beginPath();ctx.arc(hx-2,hy-2,2,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(hx+2,hy-2,2,0,Math.PI*2);ctx.fill();
        }
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='12px monospace';
            for(let i=0;i<4;i++){const sa=Date.now()/250+i*Math.PI/2;ctx.fillText('\u2605',cx+Math.cos(sa)*45,pos.y-30+Math.sin(sa)*6);}}
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';
        ctx.fillText('HYDRA',cx,pos.y-35);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-45,pos.y-30,90,7,3);ctx.fill();
        ctx.fillStyle=this.hp>30?'#4D4':'#F00';ctx.beginPath();ctx.roundRect(cx-44,pos.y-29,88*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}

// W15: Stein-Samurai
class StoneSamurai extends Enemy {
    constructor(x,y) {
        super(x,y,24,26); this.hp=8; this.maxHp=8; this.speed=60; this.damage=2;
        this.detectionRange=160; this.dashTimer=0; this.dashCooldown=2;
        this.dashing=false; this.dashDir={x:0,y:0}; this.dashT=0; this.facingA=0;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(this.dashing){this.dashT-=dt;
            this.x+=this.dashDir.x*200*dt;this.y+=this.dashDir.y*200*dt;
            if(dist<30)player.takeDamage(2,this.facingA,150);
            if(this.dashT<=0)this.dashing=false;return;}
        if(dist<this.detectionRange){
            this.facingA=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(this.facingA)*this.speed*0.4*dt,Math.sin(this.facingA)*this.speed*0.4*dt,world);
            this.dashTimer-=dt;
            if(this.dashTimer<=0&&dist<80){this.dashTimer=this.dashCooldown;
                this.dashing=true;this.dashT=0.3;this.dashDir=vecNormalize(vecSub(pc,mc));}
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();
            for(let i=0;i<6;i++){ctx.globalAlpha=(1-t);ctx.fillStyle='#999';
                ctx.fillRect(cx+Math.cos(i*1.1)*t*25-3,cy+Math.sin(i*0.9)*t*25-3,6,6);}
            ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        ctx.fillStyle='#888';ctx.beginPath();ctx.roundRect(cx-10,cy-6,20,18,3);ctx.fill();
        ctx.fillStyle='#AAA';ctx.beginPath();ctx.arc(cx,cy-10,9,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#777';ctx.beginPath();ctx.arc(cx,cy-12,9,Math.PI*1.1,Math.PI*1.9);ctx.fill();
        ctx.fillStyle='#F00';ctx.beginPath();ctx.arc(cx-3,cy-10,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+3,cy-10,2,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#BBB';ctx.lineWidth=2;ctx.beginPath();
        ctx.moveTo(cx+8,cy-4);ctx.lineTo(cx+8+Math.cos(this.facingA)*16,cy-4+Math.sin(this.facingA)*14);ctx.stroke();
        if(this.dashing){ctx.globalAlpha=0.3;ctx.strokeStyle='#FFF';ctx.lineWidth=2;
            ctx.beginPath();ctx.arc(cx,cy,20,this.facingA-0.5,this.facingA+0.5);ctx.stroke();}
        ctx.restore();
    }
}

// W15 Boss: STEIN-DÄMON (6 Arme, 6 Schwerter)
class BossStoneDemon extends Enemy {
    constructor(x,y) {
        super(x,y,110,100); this.hp=70; this.maxHp=70; this.speed=25;
        this.damage=3; this.isBoss=true; this.contactDamage=false;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.whirlTimer=5; this.chargeTimer=8; this.phase=1;
        this.whirling=false; this.whirlT=0; this.chargeDir={x:0,y:0}; this.chargeT=0;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return;
        if(this.hp<=35&&this.phase===1){this.phase=2;this.speed=40;}
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='chase';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='chase';return;}
        if(this.state==='whirl'){this.whirlT+=dt;
            if(vecDist(mc,pc)<80){player.takeDamage(2,angleBetween(mc,pc),200);
                if(particles)for(let i=0;i<4;i++)particles.push(new Particle(pc.x,pc.y,randRange(-40,40),randRange(-40,40),'#999',0.3));}
            if(this.whirlT>2){this.state='stunned';this.stunnedTimer=2.5;}return;}
        if(this.state==='charge'){this.chargeT+=dt;
            this.x+=this.chargeDir.x*250*dt;this.y+=this.chargeDir.y*250*dt;
            if(typeof Game!=='undefined')Game.camera.shake(5,0.15);
            if(vecDist(mc,pc)<70){player.takeDamage(3,angleBetween(mc,pc),350);}
            if(this.chargeT>1.2){this.state='stunned';this.stunnedTimer=2;}return;}
        const a=angleBetween(mc,pc);
        this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
        this.whirlTimer-=dt;this.chargeTimer-=dt;
        if(this.whirlTimer<=0){this.whirlTimer=this.phase===1?5:3;this.state='whirl';this.whirlT=0;}
        if(this.chargeTimer<=0){this.chargeTimer=this.phase===1?8:5;
            this.state='charge';this.chargeDir=vecNormalize(vecSub(pc,mc));this.chargeT=0;}
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();
            // 6 swords float then shatter
            for(let i=0;i<6;i++){ctx.globalAlpha=(1-t);ctx.strokeStyle='#CCC';ctx.lineWidth=3;
                const sa=(Math.PI*2*i)/6+t*2;const sd=20+t*50;
                ctx.beginPath();ctx.moveTo(cx+Math.cos(sa)*sd,cy+Math.sin(sa)*sd);
                ctx.lineTo(cx+Math.cos(sa)*(sd+15),cy+Math.sin(sa)*(sd+15));ctx.stroke();}
            for(let i=0;i<12;i++){ctx.globalAlpha=(1-t)*0.6;ctx.fillStyle='#999';
                const a=(Math.PI*2*i)/12+t*3;ctx.fillRect(cx+Math.cos(a)*t*70-3,cy+Math.sin(a)*t*70-3,6,6);}
            ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        // Body
        ctx.fillStyle='#777';ctx.beginPath();ctx.ellipse(cx,cy,40,35,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#888';ctx.beginPath();ctx.ellipse(cx,cy-5,30,28,0,0,Math.PI*2);ctx.fill();
        // 6 Arms with swords
        const whirlAngle=this.state==='whirl'?this.whirlT*10:0;
        for(let i=0;i<6;i++){
            const aa=(Math.PI*2*i)/6+whirlAngle;const ax=cx+Math.cos(aa)*38;const ay=cy+Math.sin(aa)*30;
            ctx.strokeStyle='#888';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx+Math.cos(aa)*20,cy+Math.sin(aa)*15);ctx.lineTo(ax,ay);ctx.stroke();
            ctx.strokeStyle='#CCC';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+Math.cos(aa)*18,ay+Math.sin(aa)*14);ctx.stroke();
        }
        // Head with horns
        ctx.fillStyle='#999';ctx.beginPath();ctx.arc(cx,cy-30,16,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#AAA';
        ctx.beginPath();ctx.moveTo(cx-14,cy-35);ctx.lineTo(cx-22,cy-55);ctx.lineTo(cx-8,cy-38);ctx.fill();
        ctx.beginPath();ctx.moveTo(cx+14,cy-35);ctx.lineTo(cx+22,cy-55);ctx.lineTo(cx+8,cy-38);ctx.fill();
        // Helmet
        ctx.fillStyle='#666';ctx.beginPath();ctx.arc(cx,cy-32,16,Math.PI,0);ctx.fill();
        // Eyes
        ctx.fillStyle='#F00';ctx.beginPath();ctx.arc(cx-6,cy-30,4,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+6,cy-30,4,0,Math.PI*2);ctx.fill();
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='14px monospace';
            for(let i=0;i<4;i++){const sa=Date.now()/250+i*Math.PI/2;ctx.fillText('\u2605',cx+Math.cos(sa)*45,pos.y-50+Math.sin(sa)*6);}}
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';
        ctx.fillText('STEIN-D\u00c4MON',cx,pos.y-55);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-45,pos.y-50,90,7,3);ctx.fill();
        ctx.fillStyle=this.hp>30?'#AAA':'#F00';ctx.beginPath();ctx.roundRect(cx-44,pos.y-49,88*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}

// ── Training Arena Enemies ──

// Gemeinsame Helfer der Welten 16–21 und des Trainingsplatzes:
// Vorwarnungen, Todes-Plopp, Schlüssel-Abzeichen und das Aussehen der Geschosse.
const LateWorldArt = {
    // Rechteck frei (keine Wand, innerhalb der Karte)?
    free(world, x, y, w, h) {
        return !!world && world.collideRect({ x, y, w, h }).length === 0;
    },

    // Schaden am Spieler mit der üblichen Rückmeldung (Wackeln, Ton, roter Rand).
    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && Game.player === player && typeof Game._hurtPlayer === 'function') {
            Game._hurtPlayer(amount, angle, force);
        } else if (player && player.takeDamage) {
            player.takeDamage(amount, angle, force);
        }
    },

    shake(strength, time) {
        if (typeof Game !== 'undefined' && Game.camera && Game.camera.shake) Game.camera.shake(strength, time);
    },

    // Gegner-Geschoss mit eigenem Aussehen (look = eine der shot…-Funktionen unten).
    shoot(x, y, angle, speed, knockback, look) {
        if (typeof Game === 'undefined' || !Game.projectiles) return null;
        const p = new Projectile(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', knockback);
        if (look) p.draw = look;
        Game.projectiles.push(p);
        return p;
    },

    // Ring aus n Geschossen; offset dreht den Ring.
    shootRing(x, y, n, speed, knockback, offset, look) {
        for (let i = 0; i < n; i++) this.shoot(x, y, offset + (TAU * i) / n, speed, knockback, look);
    },

    // Todes-Plopp normaler Gegner: kurz aufblähen, dann schrumpfen und verblassen.
    // Ändert Transformation und Alpha (Aufrufer klammert mit save/restore).
    deathPop(ctx, e, cx, cy) {
        const p = clamp(e.deathProgress(), 0, 1);
        const s = p < 0.3 ? 1 + p : 1.3 * (1 - (p - 0.3) / 0.7);
        if (s < 0.04) return false;
        ctx.globalAlpha *= clamp(1.3 - p * 1.3, 0, 1);
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.translate(-cx, -cy);
        return true;
    },

    // Besiegter Boss: zittert im Siegesmoment, schrumpft, sobald der Todes-Timer läuft.
    bossDeath(ctx, e, cx, cy) {
        const p = clamp(e.deathProgress(), 0, 1);
        const s = Math.max(0.05, 1 - p * p * 0.9);
        ctx.globalAlpha *= clamp(1.2 - p, 0, 1);
        ctx.translate(cx + Math.sin(Art.time * 47) * 1.6, cy);
        ctx.rotate(Math.sin(Art.time * 31) * 0.025);
        ctx.scale(s, s);
        ctx.translate(-cx, -cy);
    },

    // Warnkreis am Boden; k = 0..1 füllt sich, bei 1 kommt der Angriff.
    warn(ctx, x, y, r, k, color = '#ff3d5a') {
        const prev = ctx.globalAlpha;
        const pulse = 0.5 + 0.5 * Math.sin(Art.time * 16);
        ctx.fillStyle = color;
        ctx.globalAlpha = prev * (0.1 + 0.08 * pulse);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev * (0.16 + 0.22 * k);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, r * clamp(k, 0, 1)), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev * (0.55 + 0.45 * pulse);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = prev;
    },

    // Strahlen in die Flugrichtungen eines Geschoss-Rings (Vorwarnung), k = 0..1.
    rays(ctx, x, y, n, offset, r0, r1, k, color = '#ff3d5a') {
        const prev = ctx.globalAlpha;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const a = offset + (TAU * i) / n;
            ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
            ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        }
        ctx.globalAlpha = prev * 0.2;
        ctx.lineWidth = 7;
        ctx.stroke();
        const r2 = r0 + (r1 - r0) * clamp(k, 0, 1);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const a = offset + (TAU * i) / n;
            ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
            ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
        }
        ctx.globalAlpha = prev * (0.6 + 0.3 * Math.sin(Art.time * 18));
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.globalAlpha = prev;
    },

    // Warnbahn für Anstürme: von (x, y) in Richtung a, Länge len, Breite w; k = Füllstand.
    lane(ctx, x, y, a, len, w, k, color = '#ff3d5a') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        const prev = ctx.globalAlpha;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.globalAlpha = prev * 0.14;
        ctx.beginPath();
        ctx.roundRect(0, -w / 2, len, w, w / 2);
        ctx.fill();
        ctx.globalAlpha = prev * (0.45 + 0.35 * Math.abs(Math.sin(Art.time * 10)));
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = prev * (0.14 + 0.18 * k);
        ctx.beginPath();
        ctx.roundRect(0, -w / 2, Math.max(w, len * clamp(k, 0, 1)), w, w / 2);
        ctx.fill();
        // Pfeilspitzen wandern nach vorn
        const s = Math.min(14, w * 0.3);
        const gap = len / 3;
        const off = (Art.time * 70) % gap;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const px = off + i * gap;
            if (px < s + 2 || px > len - 4) continue;
            ctx.moveTo(px - s, -s);
            ctx.lineTo(px, 0);
            ctx.lineTo(px - s, s);
        }
        ctx.globalAlpha = prev * 0.8;
        ctx.stroke();
        ctx.globalAlpha = prev;
        ctx.restore();
    },

    // Zwei kleine Pfeilspitzen vor normalen Gegnern (Richtung eines Sprints), k = 0..1.
    chevrons(ctx, x, y, a, k, color = '#ff3d5a') {
        const ca = Math.cos(a), sa = Math.sin(a);
        const prev = ctx.globalAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < 2; i++) {
            const d = 16 + i * 7 + k * 3;
            const px = x + ca * d, py = y + sa * d;
            ctx.moveTo(px - ca * 4 - sa * 4, py - sa * 4 + ca * 4);
            ctx.lineTo(px, py);
            ctx.lineTo(px - ca * 4 + sa * 4, py - sa * 4 - ca * 4);
        }
        ctx.globalAlpha = prev * (0.5 + 0.5 * Math.abs(Math.sin(Art.time * 12)));
        ctx.stroke();
        ctx.globalAlpha = prev;
    },

    // Goldener Schlüssel über Schlüsselträgern.
    keyBadge(ctx, x, y) {
        const b = Math.sin(Art.time * 4) * 1.5;
        Art.glow(ctx, x, y + b, 11, '#ffd23f', 0.6);
        Art.key(ctx, x - 1.8, y + b, 5, '#ffd23f');
    },

    // Kreisende Sterne (benommen).
    dizzy(ctx, x, y, rx, size = 3.2) {
        for (let i = 0; i < 3; i++) {
            const a = Art.time * 5 + (i * TAU) / 3;
            Art.star(ctx, x + Math.cos(a) * rx, y + Math.sin(a) * rx * 0.35, size, '#ffe35a', { lineWidth: 1 });
        }
    },

    // Durchgestrichene Augen (besiegt).
    xEyes(ctx, x, y, r, gap) {
        ctx.strokeStyle = Art.INK;
        ctx.lineWidth = Math.max(1.1, r * 0.45);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let s = -1; s <= 1; s += 2) {
            const ex = x + s * gap;
            ctx.moveTo(ex - r, y - r);
            ctx.lineTo(ex + r, y + r);
            ctx.moveTo(ex + r, y - r);
            ctx.lineTo(ex - r, y + r);
        }
        ctx.stroke();
    },

    // Tempo-Striche hinter einer Figur (a = Bewegungsrichtung).
    speedLines(ctx, x, y, a, len, spread, color = '#ffffff') {
        const bx = -Math.cos(a), by = -Math.sin(a);
        const nx = -by, ny = bx;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.75;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            const j = (Art.time * 9 + (i + 2) * 0.37) % 1;
            const l = len * (0.55 + 0.45 * j);
            const sx = x + nx * i * spread + bx * 6;
            const sy = y + ny * i * spread + by * 6;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + bx * l, sy + by * l);
        }
        ctx.stroke();
        ctx.globalAlpha = prev;
    },

    // Staubwölkchen links und rechts eines Punktes (k = 0..1 Verlauf).
    dust(ctx, x, y, r, k) {
        const prev = ctx.globalAlpha;
        const rr = r * (0.55 + k * 0.6);
        const dx = r * (0.7 + k * 1.1);
        const yy = y - k * r * 0.5;
        ctx.fillStyle = '#f3ecff';
        ctx.globalAlpha = prev * 0.6 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(x - dx + rr, yy);
        ctx.arc(x - dx, yy, rr, 0, TAU);
        ctx.moveTo(x + dx + rr, yy);
        ctx.arc(x + dx, yy, rr, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev;
    },

    // Kleines Teil (Fuß, Hand, Höcker): flache Farbe mit Umriss – günstiger als Art.body,
    // bei wenigen Einheiten Größe sieht man den Verlauf ohnehin nicht.
    blob(ctx, x, y, rx, ry, color, lw = 1.1) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = Art.ink(color);
        ctx.stroke();
    },

    // Vieleck (ohne beginPath).
    poly(ctx, x, y, r, n, rot) {
        for (let i = 0; i < n; i++) {
            const a = rot + (i * TAU) / n;
            if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
    },

    // Zahnrad-Umriss (ohne beginPath).
    gearPath(ctx, x, y, r, teeth, rot) {
        const ri = r * 0.78;
        const step = TAU / teeth;
        for (let i = 0; i < teeth; i++) {
            const a = rot + i * step;
            if (i === 0) ctx.moveTo(x + Math.cos(a) * ri, y + Math.sin(a) * ri);
            ctx.lineTo(x + Math.cos(a + step * 0.16) * r, y + Math.sin(a + step * 0.16) * r);
            ctx.lineTo(x + Math.cos(a + step * 0.48) * r, y + Math.sin(a + step * 0.48) * r);
            ctx.lineTo(x + Math.cos(a + step * 0.64) * ri, y + Math.sin(a + step * 0.64) * ri);
            ctx.lineTo(x + Math.cos(a + step) * ri, y + Math.sin(a + step) * ri);
        }
        ctx.closePath();
    },

    // Apfel-Umriss um (0, 0), etwa 21 × 20 Einheiten (für Art.shape).
    applePath(c) {
        c.moveTo(0, -7.5);
        c.bezierCurveTo(4, -11.5, 11, -9.5, 10.5, -1.5);
        c.bezierCurveTo(10, 6.5, 5, 10.5, 0, 9.5);
        c.bezierCurveTo(-5, 10.5, -10, 6.5, -10.5, -1.5);
        c.bezierCurveTo(-11, -9.5, -4, -11.5, 0, -7.5);
        c.closePath();
    },

    // Blatt, Ursprung am Stiel, zeigt nach rechts oben (für Art.shape).
    leafPath(c) {
        c.moveTo(0, 0);
        c.quadraticCurveTo(3, -4.8, 7.8, -3.4);
        c.quadraticCurveTo(4.6, 1.2, 0, 0);
        c.closePath();
    },

    // Stirnband-Enden, die hinter einer Figur flattern (side = Blickrichtung ±1).
    bandTails(ctx, kx, ky, side, s, wave, color) {
        const b = -side;
        ctx.beginPath();
        ctx.moveTo(kx, ky - 0.9 * s);
        ctx.quadraticCurveTo(kx + b * 4 * s, ky - 3.4 * s + wave, kx + b * 8.5 * s, ky - 2.2 * s + wave);
        ctx.lineTo(kx + b * 7.6 * s, ky + 0.1 * s + wave);
        ctx.quadraticCurveTo(kx + b * 4 * s, ky - 0.8 * s, kx, ky + 0.5 * s);
        ctx.moveTo(kx, ky + 0.3 * s);
        ctx.quadraticCurveTo(kx + b * 3.6 * s, ky + 1.4 * s - wave, kx + b * 7 * s, ky + 3.6 * s - wave);
        ctx.lineTo(kx + b * 5.7 * s, ky + 4.9 * s - wave);
        ctx.quadraticCurveTo(kx + b * 3 * s, ky + 2.5 * s, kx, ky + 1.5 * s);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = Art.ink(color);
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.stroke();
    },

    // ── Geschosse: werden als p.draw gesetzt (this = Geschoss) ──

    _trail(ctx, x, y, vx, vy, w, color) {
        const sp = Math.hypot(vx, vy) || 1;
        const len = Math.min(14, sp * 0.07);
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.35;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - (vx / sp) * len, y - (vy / sp) * len);
        ctx.stroke();
        ctx.globalAlpha = prev;
    },

    // Schaumstoffball der Übungsroboter.
    shotFoam(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, 6, '#ffb347');
        Art.glow(ctx, p.x, p.y, 13, '#ff8a3d', 0.5);
        Art.body(ctx, p.x, p.y, 5, 5, '#ff9f1c', { lineWidth: 1.3 });
    },

    // Kiwi-Wurfstern (bremst, deshalb eisblauer Schimmer).
    shotKiwi(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        Art.glow(ctx, p.x, p.y, 16, '#7fd8ff', 0.75);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.age * 14);
        Art.star(ctx, 0, 0, 7.5, '#8fdc3a', { points: 4, inner: 0.45, lineWidth: 1.3, outline: '#2f6b1c' });
        ctx.fillStyle = '#f6f9d2';
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#24160c';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a = i * (TAU / 4) + Math.PI / 4;
            const sx = Math.cos(a) * 3.4, sy = Math.sin(a) * 3.4;
            ctx.moveTo(sx + 0.8, sy);
            ctx.arc(sx, sy, 0.8, 0, TAU);
        }
        ctx.fill();
        ctx.restore();
        Art.ring(ctx, p.x, p.y, 9, '#c8f2ff', 1.2, 0.7);
    },

    // Orangensaft-Tropfen des Frucht-Giganten (orange, damit sie vor dem pinken Körper auffallen).
    shotJuice(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        Art.glow(ctx, p.x, p.y, 14, '#ff7a1c', 0.65);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.quadraticCurveTo(-3, -5, 1.5, -4.6);
        ctx.arc(1.5, 0, 4.6, -Math.PI / 2, Math.PI / 2);
        ctx.quadraticCurveTo(-3, 5, -9, 0);
        ctx.closePath();
        ctx.fillStyle = '#ff9f1c';
        ctx.fill();
        ctx.strokeStyle = '#8a3a00';
        ctx.lineWidth = 1.3;
        ctx.stroke();
        Art.shine(ctx, 1.5, -1.8, 2, 1.2, 0, 0.75);
        ctx.restore();
    },

    // Zeitblase mit Zeigern (bremst).
    shotTime(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        Art.glow(ctx, p.x, p.y, 16, '#6fe7ff', 0.75);
        Art.body(ctx, p.x, p.y, 5.6, 5.6, '#b8f6ff', { outline: '#2a6fd6', lineWidth: 1.3, highlight: false });
        const a = this.age * 10;
        ctx.strokeStyle = '#1f3a8a';
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a * 0.3) * 2.6, p.y + Math.sin(a * 0.3) * 2.6);
        ctx.stroke();
        Art.shine(ctx, p.x - 2, p.y - 2.4, 1.6, 1, -0.6, 0.8);
    },

    // Goldene Zeit-Münze der Zeitkugel (bremst nicht).
    shotChrono(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, 6, '#ffb020');
        Art.glow(ctx, p.x, p.y, 14, '#ff9f1c', 0.6);
        Art.body(ctx, p.x, p.y, 5.4, 5.4, '#ffd23f', { outline: '#8a5a00', lineWidth: 1.3, highlight: false });
        const a = this.age * 12;
        ctx.strokeStyle = '#8a5a00';
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * 3.6, p.y + Math.sin(a) * 3.6);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - 2.4);
        ctx.stroke();
        Art.shine(ctx, p.x - 2, p.y - 2.4, 1.6, 1, -0.6, 0.8);
    },

    // Schattenkugel der Krokodile.
    shotShadow(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, 7, '#7b5cff');
        Art.glow(ctx, p.x, p.y, 16, '#7dff9e', 0.55);
        Art.body(ctx, p.x, p.y, 5.8, 5.8, '#5b3fd6', { outline: '#1c1057', lineWidth: 1.3, highlight: false });
        Art.body(ctx, p.x, p.y, 2.6, 2.6, '#c8ff8a', { outline: false, highlight: false, flat: true });
        Art.shine(ctx, p.x - 2.2, p.y - 2.6, 1.6, 1, -0.6, 0.6);
    },

    // Mini-Fußball.
    shotBall(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, 7, '#ffb020');
        Art.glow(ctx, p.x, p.y, 14, '#ff8a3d', 0.55);
        Art.body(ctx, p.x, p.y, 5.8, 5.8, '#ffffff', { outline: '#26325c', lineWidth: 1.3, highlight: false });
        ctx.fillStyle = '#26325c';
        ctx.beginPath();
        LateWorldArt.poly(ctx, p.x, p.y, 2.4, 5, this.age * 9);
        ctx.fill();
        Art.shine(ctx, p.x - 2.2, p.y - 2.6, 1.6, 1, -0.6, 0.8);
    },

    // Schraubenmutter der Waschbären.
    shotNut(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, 6, '#ffb347');
        Art.glow(ctx, p.x, p.y, 13, '#ff9f43', 0.5);
        ctx.beginPath();
        LateWorldArt.poly(ctx, p.x, p.y, 5.6, 6, this.age * 12);
        ctx.fillStyle = '#c9d6ec';
        ctx.fill();
        ctx.strokeStyle = '#3b3f6b';
        ctx.lineWidth = 1.3;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.fillStyle = '#3b3f6b';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, TAU);
        ctx.fill();
        Art.shine(ctx, p.x - 2, p.y - 2.8, 1.8, 1, -0.6, 0.7);
    },

    // Zahnrad des Riesen-Waschbären.
    shotGear(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, 8, '#ffb347');
        Art.glow(ctx, p.x, p.y, 16, '#ff9f43', 0.6);
        ctx.beginPath();
        LateWorldArt.gearPath(ctx, p.x, p.y, 7, 7, this.age * 10);
        ctx.fillStyle = '#ffb347';
        ctx.fill();
        ctx.strokeStyle = '#6b3a12';
        ctx.lineWidth = 1.4;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.fillStyle = '#6b3a12';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, TAU);
        ctx.fill();
    },
};

// Übungs-Zielscheibe: steht auf einer Feder und wippt bei Treffern nach (harmlos).
class TrainingTargetRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 3;
        this.maxHp = 3;
        this.contactDamage = false;
        this.damage = 0;
        this.fxColor = '#ff5d73';
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 0.3 };
        this.wobble = 0;
        this._lastHp = this.hp;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp < this._lastHp) this.wobble = 1;
        this._lastHp = this.hp;
        this.wobble = Math.max(0, this.wobble - dt * 1.5);
        if (player) {
            const dx = player.x + player.w / 2 - this.centerX();
            const dy = player.y + player.h / 2 - this.centerY();
            const d = Math.hypot(dx, dy) || 1;
            this.look.x = dx / d;
            this.look.y = dy / d;
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        // Sockel mit Warnstreifen
        Art.box(ctx, cx - 9, by - 4.5, 18, 5, 2.2, '#5f73b3');
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(cx - 6.5, by - 2.8, 3, 1.8);
        ctx.fillRect(cx - 1.5, by - 2.8, 3, 1.8);
        ctx.fillRect(cx + 3.5, by - 2.8, 3, 1.8);
        // Stehaufmännchen: kippt um die Feder
        const tilt = Math.sin(t * 16) * 0.42 * this.wobble + Math.sin(t * 1.6 + this.seed) * 0.05;
        ctx.translate(cx, by - 4.5);
        ctx.rotate(tilt);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-2.4, -0.9);
        ctx.lineTo(2.4, -1.8);
        ctx.lineTo(-2.4, -2.7);
        ctx.lineTo(0, -3.6);
        ctx.strokeStyle = '#2f3566';
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.strokeStyle = '#e8eeff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Zielscheibe als Bauch
        const dy = -10.5;
        Art.body(ctx, 0, dy, 9, 7.8, '#ff4d5e', { highlight: false });
        ctx.fillStyle = '#fff6ee';
        ctx.beginPath();
        ctx.ellipse(0, dy, 6.3, 5.4, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ff4d5e';
        ctx.beginPath();
        ctx.ellipse(0, dy, 3.8, 3.3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(0, dy, 1.6, 0, TAU);
        ctx.fill();
        Art.shine(ctx, -4.3, dy - 3.8, 2.6, 1.4, -0.6, 0.5);
        // Kopf mit Antenne
        const hy = dy - 10;
        const bulbOn = Math.sin(t * 5 + this.seed) > 0;
        Art.limb(ctx, 0, hy - 3.5, 0, hy - 6.6, 1.1, '#9aa7dd');
        LateWorldArt.blob(ctx, 0, hy - 7.4, 1.7, 1.7, bulbOn ? '#fff27a' : '#ffb020', 1);
        Art.body(ctx, 0, hy, 7, 4.9, '#c6d4ff');
        const hit = this.wobble > 0.35;
        if (this.dead) LateWorldArt.xEyes(ctx, 0, hy - 0.5, 1.3, 2.7);
        else Art.eyes(ctx, this.look.x * 0.7, hy - 0.7, 1.8, { gap: 2.8, look: this.look, seed: this.seed, sad: hit });
        Art.mouth(ctx, 0, hy + 2.5, 3.2, hit || this.dead ? 'o' : 'smile');
        ctx.restore();
    }
}

// Schwebender Streifen-Roboter: fliegt ein Quadrat ab (harmlos).
class TrainingPatrolRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 26);
        this.hp = 5;
        this.maxHp = 5;
        this.contactDamage = false;
        this.damage = 0;
        this.fxColor = '#4cc9f0';
        this.flying = true;
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.points = [
            { x: x - 30, y: y - 30 },
            { x: x + 30, y: y - 30 },
            { x: x + 30, y: y + 30 },
            { x: x - 30, y: y + 30 }
        ];
        this.targetIndex = 0;
        this.stuckT = 0;
        this._routeChecked = false;
    }
    update(dt, world) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (!this._routeChecked) this._checkRoute(world);
        if (!this.points.length) return;
        const p = this.points[this.targetIndex];
        const dx = p.x - this.centerX();
        const dy = p.y - this.centerY();
        const d = Math.hypot(dx, dy);
        if (d < 10) {
            this.targetIndex = (this.targetIndex + 1) % this.points.length;
            this.stuckT = 0;
            return;
        }
        this.look.x = dx / d;
        this.look.y = dy / d;
        const ox = this.x, oy = this.y;
        this._moveWithCollision(this.look.x * 55 * dt, this.look.y * 55 * dt, world);
        // Kommt er nicht weiter (Wand, Wasser), zum nächsten Wegpunkt wechseln
        const moved = Math.abs(this.x - ox) + Math.abs(this.y - oy);
        this.stuckT = moved < 55 * dt * 0.3 ? this.stuckT + dt : 0;
        if (this.stuckT > 0.6) {
            this.stuckT = 0;
            this.targetIndex = (this.targetIndex + 1) % this.points.length;
        }
    }
    // Nur Wegpunkte und Strecken ohne Wand, Wasser oder Busch benutzen (U-04).
    _checkRoute(world) {
        this._routeChecked = true;
        if (!world || !world.collideRect) return;
        const okPoint = p => this._clear(world, p.x, p.y);
        const okSeg = (a, b) => {
            for (let i = 1; i < 4; i++) {
                if (!this._clear(world, a.x + (b.x - a.x) * i / 4, a.y + (b.y - a.y) * i / 4)) return false;
            }
            return true;
        };
        const pts = this.points;
        const all = pts.every(okPoint) && pts.every((p, i) => okSeg(p, pts[(i + 1) % pts.length]));
        if (all) return;
        // Sonst: hin und her auf der ersten freien Strecke, notfalls auf der Stelle schweben
        for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[(i + 1) % pts.length];
            if (okPoint(a) && okPoint(b) && okSeg(a, b)) {
                this.points = [a, b];
                this.targetIndex = 0;
                return;
            }
        }
        this.points = [];
    }
    _clear(world, x, y) {
        if (!LateWorldArt.free(world, x - this.w / 2, y - this.h / 2, this.w, this.h)) return false;
        return !(world.isBush && world.isBush(x, y));
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const lk = this.look;
        const hov = Math.sin(t * 3.2 + this.seed) * 1.8;
        const flame = 0.5 + 0.5 * Math.sin(t * 23 + this.seed);
        ctx.translate(cx, cy - 3 + hov);
        ctx.rotate(lk.x * 0.12);
        // Düse mit flackernder Schwebe-Flamme
        ctx.fillStyle = '#b8fbff';
        ctx.beginPath();
        ctx.ellipse(0, 11.5, 2.6, 2.4 + flame * 2.2, 0, 0, TAU);
        ctx.fill();
        const prevA = ctx.globalAlpha;
        ctx.fillStyle = '#7df9ff';
        ctx.globalAlpha = prevA * 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 12.5, 1.6 + flame * 0.6, 3 + flame * 2.6, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prevA;
        Art.box(ctx, -4.5, 5.5, 9, 4.5, 2, '#5f73b3', { highlight: false });
        // Seitenlichter
        LateWorldArt.blob(ctx, -12, 0, 2.2, 3.4, '#ffd23f', 1.2);
        LateWorldArt.blob(ctx, 12, 0, 2.2, 3.4, '#ffd23f', 1.2);
        // Körper mit gelbem Übungs-Streifen
        Art.box(ctx, -11.5, -9, 23, 16.5, 7.5, '#4cc9f0');
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(-7.5, 4.2, 15, 1.8);
        // Visier mit LED-Augen, die in Flugrichtung schauen
        Art.box(ctx, -8.5, -6, 17, 8.5, 4, '#1d2553', { highlight: false, lineWidth: 1.2 });
        const bl = this.dead ? 0.25 : Art.blink(this.seed);
        const ex = lk.x * 2.2, ey = lk.y * 1.1;
        const eh = Math.max(0.8, 4.6 * bl);
        ctx.fillStyle = '#7df9ff';
        ctx.beginPath();
        ctx.roundRect(-5.2 + ex, -3.9 + ey + (4.6 - eh) / 2, 3.2, eh, 1.4);
        ctx.roundRect(2 + ex, -3.9 + ey + (4.6 - eh) / 2, 3.2, eh, 1.4);
        ctx.fill();
        // Blaulicht: blinkt rot/blau
        Art.limb(ctx, 0, -9, 0, -11, 1.6, '#9aa7dd');
        const siren = Math.floor(t * 3 + this.seed) % 2 === 0 ? '#ff4d6d' : '#4d8bff';
        Art.body(ctx, 0, -12.6, 3.2, 2.5, siren, { lineWidth: 1.1 });
        Art.ring(ctx, 0, -12.6, 4.8 + (t * 6 % 1) * 2.5, siren, 1.2, 0.6);
        ctx.restore();
    }
}

// Übungs-Kanone: lädt sichtbar auf und schießt weiche Schaumstoffbälle.
class TrainingShooterRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.contactDamage = false;
        this.damage = 0;
        this.fxColor = '#ff9f1c';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.aim = 0;
        this.recoil = 0;
        this.charging = false;
        this.shootTimer = 1;   // erster Schuss erst nach sichtbarem Aufladen
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.aim = Math.atan2(dy, dx);
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.recoil = Math.max(0, this.recoil - dt * 4);
        const inRange = dist < 260;
        // Jeder Schuss wird 0,45 s vorher angekündigt (Rohr leuchtet auf)
        this.shootTimer = inRange ? this.shootTimer - dt : Math.max(0.45, this.shootTimer - dt);
        this.charging = inRange && this.shootTimer < 0.45;
        if (inRange && this.shootTimer <= 0) {
            this.shootTimer = 2.2;
            this.recoil = 1;
            const f = dx >= 0 ? 1 : -1;
            let sx = mx + f * 8 + Math.cos(this.aim) * 12;
            let sy = my + 3 + Math.sin(this.aim) * 12;
            if (world && world.isWall(sx, sy)) { sx = mx; sy = my; }
            LateWorldArt.shoot(sx, sy, this.aim, 120, 60, LateWorldArt.shotFoam);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const lk = this.look;
        const f = Math.cos(this.aim) >= 0 ? 1 : -1;
        const ch = this.charging && !this.dead ? clamp(1 - this.shootTimer / 0.45, 0, 1) : 0;
        // Kettenfahrwerk
        Art.box(ctx, cx - 11, by - 6.5, 22, 6.5, 3.2, '#56649a');
        ctx.fillStyle = '#b8c4e8';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            ctx.moveTo(cx + i * 6.5 + 1.6, by - 3.2);
            ctx.arc(cx + i * 6.5, by - 3.2, 1.6, 0, TAU);
        }
        ctx.fill();
        // Antenne
        Art.limb(ctx, cx - 4, cy - 6, cx - 6.5, cy - 11, 1.1, '#9aa7dd');
        LateWorldArt.blob(ctx, cx - 6.5, cy - 11.8, 1.8, 1.8, '#ff4d5e', 1);
        // Kuppel-Körper (duckt sich beim Aufladen) mit Metallkragen und Nieten
        const sq = ch * 0.1;
        Art.body(ctx, cx, cy + sq * 5, 10.5, 9.2 * (1 - sq), '#ff9f1c');
        Art.box(ctx, cx - 9.5, cy + 4.6, 19, 2.8, 1.4, '#8d99c9', { highlight: false, lineWidth: 1.1 });
        ctx.fillStyle = '#e8eeff';
        ctx.fillRect(cx - 6.6, cy + 5.4, 1.2, 1.2);
        ctx.fillRect(cx - 0.6, cy + 5.4, 1.2, 1.2);
        ctx.fillRect(cx + 5.4, cy + 5.4, 1.2, 1.2);
        if (this.dead) LateWorldArt.xEyes(ctx, cx, cy - 2, 1.8, 3.6);
        else Art.eyes(ctx, cx + lk.x * 1.2, cy - 2.3 + sq * 5, 2.4, { gap: 3.6, look: lk, seed: this.seed, angry: ch > 0 });
        Art.mouth(ctx, cx + lk.x, cy + 2.3 + sq * 5, 3.4, ch > 0 || this.dead ? 'o' : 'smile');
        // Seitliche Kanone zielt auf Mark
        ctx.translate(cx + f * 8, cy + 3);
        if (ch > 0) {
            // gepunktete Ziellinie
            const ca = Math.cos(this.aim), sa = Math.sin(this.aim);
            const prevA = ctx.globalAlpha;
            ctx.fillStyle = '#ffd23f';
            ctx.globalAlpha = prevA * (0.35 + 0.5 * ch);
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const d = 18 + i * 6;
                ctx.moveTo(ca * d + 1.1, sa * d);
                ctx.arc(ca * d, sa * d, 1.1, 0, TAU);
            }
            ctx.fill();
            ctx.globalAlpha = prevA;
        }
        ctx.rotate(this.aim);
        const rc = this.recoil * 2.5;
        Art.box(ctx, -2 - rc, -2.8, 12, 5.6, 2.2, '#8d99c9');
        Art.box(ctx, 8 - rc, -3.5, 3.6, 7, 1.5, '#5f6fa8', { highlight: false });
        if (ch > 0) Art.glow(ctx, 12 - rc, 0, 4 + ch * 7, '#ffd23f', 0.35 + ch * 0.6);
        ctx.restore();
    }
}

// ── World 16: Fruit-Ninja enemies ──

// Apfel-Ninja: duckt sich kurz (Warnpfeile) und rollt dann auf Mark zu.
class AppleNinja extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.contactDamage = true;
        this.fxColor = '#ff3b4f';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.state = 'walk';     // walk → crouch (Ankündigung) → roll
        this.stateT = 0;
        this.rollTimer = 0;
        this.rollCooldown = 2.4;
        this.rollDir = { x: 1, y: 0 };
        this.spinA = 0;
        this.walkT = 0;
        this.facing = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.state === 'roll') {
            // Rolle mit Wand-Kollision; an einer Wand endet sie (G-08)
            const sx = this.rollDir.x * 220 * dt;
            const sy = this.rollDir.y * 220 * dt;
            const ox = this.x, oy = this.y;
            this._moveWithCollision(sx, sy, world);
            const moved = Math.abs(this.x - ox) + Math.abs(this.y - oy);
            this.spinA += (this.rollDir.x >= 0 ? 1 : -1) * 22 * dt;
            this.rollTimer -= dt;
            if (moved < (Math.abs(sx) + Math.abs(sy)) * 0.5) this.rollTimer = 0;
            if (this.rollTimer <= 0) {
                this.state = 'walk';
                this.spinA = 0;
            }
            return;
        }
        if (this.state === 'crouch') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'roll';
                this.rollTimer = 0.45;
            }
            return;
        }
        if (dist < 220) {
            this.facing = Math.atan2(dy, dx);
            this._moveWithCollision(this.look.x * 55 * dt, this.look.y * 55 * dt, world);
            this.walkT += dt;
            this.rollCooldown -= dt;
            if (this.rollCooldown <= 0) {
                this.rollCooldown = 2.2;
                this.state = 'crouch';
                this.stateT = 0.3;
                this.rollDir.x = this.look.x;
                this.rollDir.y = this.look.y;
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const lk = this.look;
        const side = lk.x >= 0 ? 1 : -1;
        const crouch = this.state === 'crouch';
        const roll = this.state === 'roll';
        const rollA = Math.atan2(this.rollDir.y, this.rollDir.x);
        const k = crouch ? 1 - this.stateT / 0.3 : 0;
        if (crouch) LateWorldArt.chevrons(ctx, cx, cy, rollA, k);
        if (roll) LateWorldArt.speedLines(ctx, cx, cy, rollA, 12, 5);
        // Füße
        if (!roll) {
            const step = Math.sin(this.walkT * 14) * 1.6;
            LateWorldArt.blob(ctx, cx - 4.5, by - 1.8 - Math.max(0, step), 3.3, 2.1, '#7a2230', 1.2);
            LateWorldArt.blob(ctx, cx + 4.5, by - 1.8 - Math.max(0, -step), 3.3, 2.1, '#7a2230', 1.2);
        }
        // Körper (gestaucht beim Ducken, dreht sich beim Rollen)
        const sq = crouch ? 0.15 * Math.min(1, k * 2.5) : 0;
        ctx.translate(cx, by - 2);
        ctx.scale(1 + sq, 1 - sq);
        ctx.translate(0, -10);
        if (roll) ctx.rotate(this.spinA);
        const hand = !roll;
        if (hand) {
            // hintere Hand und Band-Enden hinter dem Körper
            LateWorldArt.bandTails(ctx, -side * 9.4, -3.6, side, 1, Math.sin(t * 13 + this.seed) * 1.5, '#2b2f6b');
            LateWorldArt.blob(ctx, -side * 10.2, 3, 2.3, 2.3, '#e8313f', 1.2);
        }
        const col = crouch && Math.sin(t * 40) > 0 ? '#ff6b7a' : '#ff3b4f';
        Art.shape(ctx, LateWorldArt.applePath, { x: -10.5, y: -10.5, w: 21, h: 20.5 }, col, { glossy: true });
        // Augen, darüber das Stirnband: es schneidet V-förmig in die Augen (frecher Ninja-Blick)
        ctx.save();
        ctx.clip();
        const ex = lk.x * 1.4;
        if (this.dead) LateWorldArt.xEyes(ctx, ex, 1.8, 1.8, 3.5);
        else Art.eyes(ctx, ex, 1.9, 2.6, { gap: 3.6, look: lk, seed: this.seed });
        ctx.beginPath();
        ctx.moveTo(-11, -5.8);
        ctx.quadraticCurveTo(0, -9.8, 11, -5.8);
        ctx.lineTo(11, -1.8);
        ctx.lineTo(ex + 1.6, -0.2);
        ctx.lineTo(ex, 0.7);
        ctx.lineTo(ex - 1.6, -0.2);
        ctx.lineTo(-11, -1.8);
        ctx.closePath();
        ctx.fillStyle = '#2b2f6b';
        ctx.fill();
        ctx.fillStyle = '#c9d3ea';
        ctx.fillRect(ex - 1.7, -6.9, 3.4, 2.1);
        ctx.restore();
        Art.shine(ctx, -6.6, 2, 1.5, 2.6, 0.3, 0.45);
        // Stiel und Blatt
        Art.limb(ctx, 0, -7.5, 1.2, -11.5, 1.7, '#7a4a22');
        ctx.save();
        ctx.translate(1.1, -11);
        Art.shape(ctx, LateWorldArt.leafPath, { x: 0, y: -4.8, w: 7.8, h: 5.4 }, '#4cd964', { lineWidth: 1.1 });
        ctx.restore();
        Art.mouth(ctx, ex, 6.2, 4.2, crouch ? 'teeth' : (this.dead ? 'o' : 'grin'));
        // vordere Hand mit Wurfstern
        if (hand) {
            LateWorldArt.blob(ctx, side * 10.4, 3, 2.3, 2.3, '#e8313f', 1.2);
            if (crouch) Art.glow(ctx, side * 12.6, 1.4, 7, '#ffffff', 0.5);
            Art.star(ctx, side * 12.6, 1.4, 3.8, '#e6ecff', { points: 4, inner: 0.4, lineWidth: 1, rot: crouch ? t * 20 : 0.3 });
        }
        ctx.restore();
    }
}

// Kiwi-Ninja: wirft verlangsamende Kiwi-Wurfsterne (Hand hebt sich vorher leuchtend).
class KiwiNinja extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 3;
        this.maxHp = 3;
        this.contactDamage = false;
        this.fxColor = '#8fdc3a';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.spitTimer = 0.9;
        this.windup = 0;
        this.walkT = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.windup = 0;
        if (dist < 210) {
            this._moveWithCollision(this.look.x * 35 * dt, this.look.y * 35 * dt, world);
            this.walkT += dt;
            this.spitTimer -= dt;
            if (this.spitTimer < 0.4) this.windup = clamp(1 - this.spitTimer / 0.4, 0, 1);
            if (this.spitTimer <= 0) {
                this.spitTimer = 2.7;
                const a = Math.atan2(dy, dx);
                const p = LateWorldArt.shoot(mx, my, a, 130, 50, LateWorldArt.shotKiwi);
                // bremst Mark: gleiche Kennzeichnung wie alle Eis-Geschosse (G-16)
                if (p) { p.slow = true; p.isIce = true; }
            }
        } else {
            this.spitTimer = Math.max(0.4, this.spitTimer);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const lk = this.look;
        const side = lk.x >= 0 ? 1 : -1;
        const w = this.dead ? 0 : this.windup;
        // Füße
        const step = Math.sin(this.walkT * 11) * 1.4;
        LateWorldArt.blob(ctx, cx - 4, by - 1.8 - Math.max(0, step), 3.2, 2, '#6b4520', 1.2);
        LateWorldArt.blob(ctx, cx + 4, by - 1.8 - Math.max(0, -step), 3.2, 2, '#6b4520', 1.2);
        ctx.translate(cx, by - 12.5);
        LateWorldArt.bandTails(ctx, -side * 8.8, -5.6, side, 1, Math.sin(t * 12 + this.seed) * 1.5, '#ff5d8f');
        // pelzige Schale, darin das grüne Fruchtfleisch als Gesicht und das pinke Stirnband
        const brown = '#b8742e';
        Art.body(ctx, 0, 0, 9.8, 10.6, brown, { highlight: false });
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = Art.light(brown, 0.25);
        ctx.lineWidth = 0.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const a = i * 0.52 + 0.2;
            ctx.moveTo(Math.cos(a) * 8.2, Math.sin(a) * 8.9);
            ctx.lineTo(Math.cos(a + 0.1) * 9.5, Math.sin(a + 0.1) * 10.3);
        }
        ctx.stroke();
        Art.body(ctx, 0, 1.4, 7.4, 7.6, '#8fdc3a', { outline: '#4f8a1d', lineWidth: 1.1, highlight: false });
        ctx.beginPath();
        ctx.moveTo(-11, -6.8);
        ctx.quadraticCurveTo(0, -10.5, 11, -6.8);
        ctx.lineTo(11, -3.6);
        ctx.quadraticCurveTo(0, -7.2, -11, -3.6);
        ctx.closePath();
        ctx.fillStyle = '#ff5d8f';
        ctx.fill();
        ctx.strokeStyle = '#b8285c';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.restore();
        const mo = this.dead ? 0.6 : 1 + w * 0.5;
        ctx.fillStyle = w > 0.1 ? '#3a0d1e' : '#f6f9d2';
        ctx.beginPath();
        ctx.ellipse(0, 4.4, 2.5 * mo, 1.9 * mo, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#24160c';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = KiwiNinja.SEEDS[i];
            const sx = Math.cos(a) * 4.6, sy = 4.4 + Math.sin(a) * 3.4;
            ctx.moveTo(sx + 0.7, sy);
            ctx.ellipse(sx, sy, 0.7, 0.45, a, 0, TAU);
        }
        ctx.fill();
        Art.shine(ctx, -6.4, 1, 1.3, 2.4, 0.3, 0.4);
        if (this.dead) LateWorldArt.xEyes(ctx, lk.x * 1.2, -0.8, 1.6, 3.1);
        else Art.eyes(ctx, lk.x * 1.2, -1, 2.3, { gap: 3.1, look: lk, seed: this.seed, angry: w > 0 });
        // Hand mit Kiwi-Stern: hebt sich vor dem Wurf und leuchtet eisblau
        const hx = side * (10 - w * 1.5), hy = 3 - w * 10;
        if (w > 0) Art.glow(ctx, hx + side * 2, hy - 1.5, 6 + w * 7, '#7fd8ff', 0.4 + w * 0.5);
        LateWorldArt.blob(ctx, hx, hy, 2.3, 2.3, '#8a5424', 1.1);
        Art.star(ctx, hx + side * 2.2, hy - 1.6, 3.4 + w, '#8fdc3a', { points: 4, inner: 0.45, lineWidth: 1, outline: '#2f6b1c', rot: w > 0 ? t * 18 : 0.4 });
        ctx.restore();
    }
}
// Winkel der Kiwi-Kerne rund um den Mund (oben bleibt frei für die Augen)
KiwiNinja.SEEDS = [-0.3, 0.35, 1.05, 2.1, 2.8, 3.45];

// Frucht-Gigant (Welt 16): Drachenfrucht-Körper, Orangen-Kopf mit Stirnband, Bananen-Arme.
// Stampfen: springt hoch (Warnstrahlen), landet mit 8 Saft-Tropfen. Bei wenig HP einmal Explosion.
class BossFruitGiant extends Enemy {
    constructor(x, y) {
        super(x, y, 118, 100);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 18;
        this.damage = 3;
        this.isBoss = true;
        this.contactDamage = false;
        this.fxColor = '#ff4f9a';
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.state = 'intro';    // intro → chase → stompUp → stompLand → chase; einmal explode
        this.introTimer = 2;
        this.stateT = 0;
        this.stompTimer = 3.5;
        this.explosionTimer = 0;
        this.triggeredExplosion = false;
        this.phase = 1;
        this.walkT = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.hp <= 40) this.phase = 2;
        if (this.hp <= 28 && !this.triggeredExplosion) {
            this.triggeredExplosion = true;
            this.state = 'explode';
            this.explosionTimer = 1.1;
        }
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'explode') {
            this.explosionTimer -= dt;
            if (this.explosionTimer <= 0) {
                LateWorldArt.shootRing(mx, my, 12, 170, 80, 0, LateWorldArt.shotJuice);
                if (typeof FX !== 'undefined') {
                    FX.burst(mx, my, ['#ff4f9a', '#ffd23f', '#7ed957', '#ffffff'], 22, 220, 0.8);
                    FX.ring(mx, my, '#ffd6ea', 140, 0.5, 6);
                }
                LateWorldArt.shake(7, 0.35);
                this.state = 'chase';
            }
            return;
        }
        if (this.state === 'stompUp') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                // Aufprall: Schockwelle aus 8 Saft-Tropfen
                LateWorldArt.shootRing(mx, my, 8, 140, 70, 0, LateWorldArt.shotJuice);
                if (typeof FX !== 'undefined') {
                    FX.ring(mx, this.y + this.h, '#ffe0f0', 110, 0.45, 5);
                    FX.burst(mx, this.y + this.h - 6, ['#ff4f9a', '#ffd23f', '#ffffff'], 14, 170, 0.55);
                }
                LateWorldArt.shake(6, 0.25);
                this.state = 'stompLand';
                this.stateT = 0.35;
            }
            return;
        }
        if (this.state === 'stompLand') {
            this.stateT -= dt;
            if (this.stateT <= 0) this.state = 'chase';
            return;
        }
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.walkT += dt;
        this.stompTimer -= dt;
        if (this.stompTimer <= 0) {
            // gleicher Takt wie bisher (3,8 s / 2,7 s), Sprung und Landung gehören dazu
            this.stompTimer = (this.phase === 1 ? 3.8 : 2.7) - 0.95;
            this.state = 'stompUp';
            this.stateT = 0.6;
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        const lk = this.look;
        const st = this.state;
        const p2 = this.phase === 2;
        const side = lk.x >= 0 ? 1 : -1;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, cy);
        // Vorwarnungen: Flugrichtungen der Saft-Tropfen
        if (st === 'stompUp') LateWorldArt.rays(ctx, cx, cy, 8, 0, 44, 116, 1 - this.stateT / 0.6, '#ff3d7f');
        if (st === 'explode') {
            const k = 1 - this.explosionTimer / 1.1;
            LateWorldArt.warn(ctx, cx, cy, 70, k, '#ff9f1c');
            LateWorldArt.rays(ctx, cx, cy, 12, 0, 60, 130, k, '#ff7a1c');
        }
        // Haltung
        const walk = st === 'chase' ? this.walkT : 0;
        const bob = Math.sin(walk * 6) * 2 + (st === 'intro' ? Math.sin(t * 2.4) * 1.5 : 0);
        let lift = 0, sx = 1, sy = 1, arms = 0;
        if (st === 'stompUp') {
            const k = 1 - this.stateT / 0.6;
            if (k < 0.35) {
                const s = k / 0.35;
                sx = 1 + 0.1 * s; sy = 1 - 0.1 * s;
            } else {
                const s = (k - 0.35) / 0.65;
                lift = Math.sin(s * Math.PI / 2) * 18;
                sx = 0.95; sy = 1.07;
            }
            arms = Math.min(1, k * 1.6);
        } else if (st === 'stompLand') {
            const s = this.stateT / 0.35;
            sx = 1 + 0.14 * s; sy = 1 - 0.14 * s;
            arms = -s;
        }
        let swell = 1;
        let flash = false;
        if (st === 'explode') {
            const k = 1 - this.explosionTimer / 1.1;
            swell = 1 + k * 0.12 + Math.sin(t * 40) * 0.025 * k;
            flash = Math.sin(t * (14 + k * 30)) > 0.2;
            Art.glow(ctx, cx, cy, 70 + k * 30, '#ffb347', 0.35 + k * 0.4);
        }
        ctx.translate(cx, by - lift);
        ctx.scale(sx * swell, sy * swell);
        // Füße: Melonen-Hälften
        const stepA = Math.sin(walk * 6);
        this._foot(ctx, -24, -7 - Math.max(0, stepA) * 3);
        this._foot(ctx, 24, -7 - Math.max(0, -stepA) * 3);
        // Körper: Drachenfrucht
        const bodyCol = flash ? '#ffb3d6' : (p2 ? '#ff3d7f' : '#ff4f9a');
        const byy = -44 + bob;
        Art.body(ctx, 0, byy, 42, 35, bodyCol, { glossy: true, lineWidth: 2.4 });
        this._scales(ctx, byy);
        if (p2) this._drips(ctx, byy, t);
        // Arme: Bananen mit Erdbeer-Fäusten
        const swing = Math.sin(walk * 6) * 5;
        for (let s = -1; s <= 1; s += 2) {
            const shx = s * 35, shy = byy - 12;
            let fx = s * 54, fy = byy + 16 + swing * s;
            if (arms > 0) { fx = s * (54 - arms * 6); fy = byy + 16 - arms * 58; }
            if (arms < 0) { fx = s * (56 - arms * 4); fy = byy + 16 - arms * 16; }
            if (st === 'explode') { fx = s * 60; fy = byy - 6 + Math.sin(t * 30 + s) * 3; }
            this._banana(ctx, shx, shy, fx, fy, s);
            this._berry(ctx, fx, fy);
        }
        // Kopf: Orange mit Stirnband
        const hx = lk.x * 3, hy = -84 + bob * 1.2;
        const headCol = flash ? '#ffd9a8' : (p2 ? '#ff6a2b' : '#ff9f1c');
        ctx.save();
        ctx.translate(hx, hy - 19);
        Art.shape(ctx, LateWorldArt.leafPath, { x: 0, y: -4.8, w: 7.8, h: 5.4 }, '#4cd964', { lineWidth: 1.2 });
        ctx.scale(-1.2, 1.2);
        Art.shape(ctx, LateWorldArt.leafPath, { x: 0, y: -4.8, w: 7.8, h: 5.4 }, '#3fbf4a', { lineWidth: 1 });
        ctx.restore();
        Art.limb(ctx, hx, hy - 20, hx + 1, hy - 23, 2, '#7a4a22');
        LateWorldArt.bandTails(ctx, hx - side * 20.5, hy - 4.5, side, 2.1, Math.sin(t * 9 + this.seed) * 3, '#fff4ea');
        Art.body(ctx, hx, hy, 23, 21, headCol, { glossy: true, lineWidth: 2.2, highlight: false });
        ctx.save();
        ctx.clip();
        ctx.fillStyle = Art.dark(headCol, 0.16);
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
            const a = i * 0.9 + 0.4;
            const px = hx + Math.cos(a) * 15, py = hy + 6 + Math.sin(a) * 11;
            ctx.moveTo(px + 1, py);
            ctx.arc(px, py, 1, 0, TAU);
        }
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(hx - 25, hy - 8);
        ctx.quadraticCurveTo(hx, hy - 15, hx + 25, hy - 8);
        ctx.lineTo(hx + 25, hy - 1.5);
        ctx.quadraticCurveTo(hx, hy - 8.5, hx - 25, hy - 1.5);
        ctx.closePath();
        ctx.fillStyle = '#fff4ea';
        ctx.fill();
        ctx.strokeStyle = '#c99a82';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#e8283f';
        ctx.beginPath();
        ctx.arc(hx + lk.x * 6, hy - 8, 3.2, 0, TAU);
        ctx.fill();
        if (p2) {
            // Risse in der Schale
            ctx.strokeStyle = Art.dark(headCol, 0.45);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(hx + 14, hy - 3);
            ctx.lineTo(hx + 18, hy + 2);
            ctx.lineTo(hx + 15, hy + 6);
            ctx.lineTo(hx + 20, hy + 11);
            ctx.stroke();
        }
        ctx.restore();
        Art.shine(ctx, hx - 9, hy - 13, 6, 3.2, -0.6, 0.45);
        // Gesicht
        const ex = hx + lk.x * 2.5, ey = hy + 3.5;
        if (this.dead) {
            LateWorldArt.xEyes(ctx, ex, ey, 3.6, 8);
            Art.mouth(ctx, ex, hy + 12.5, 9, 'o');
        } else {
            Art.eyes(ctx, ex, ey, 5.2, { gap: 8, look: lk, angry: true, iris: p2 ? '#ff2d55' : '#7a3b10', seed: this.seed });
            const open = st === 'stompUp' || st === 'explode';
            Art.mouth(ctx, ex, hy + 12, open ? 12 : 13, open ? 'open' : 'teeth');
        }
        Art.blush(ctx, ex, hy + 9, 3.4, 13);
        if (p2) {
            // Dampf aus dem Kopf
            const prevA = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 2; i++) {
                const k = (t * 0.9 + i * 0.5) % 1;
                ctx.globalAlpha = prevA * (1 - k) * 0.5;
                ctx.beginPath();
                ctx.arc(hx + (i ? 12 : -12) + Math.sin(t * 3 + i) * 2, hy - 22 - k * 14, 3 + k * 4, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prevA;
        }
        if (st === 'stompLand') {
            const k = 1 - this.stateT / 0.35;
            LateWorldArt.dust(ctx, -34, -3, 10, k);
            LateWorldArt.dust(ctx, 34, -3, 10, k);
        }
        ctx.restore();
    }
    _foot(ctx, x, y) {
        Art.body(ctx, x, y, 14, 8, '#3fbf4a', { lineWidth: 2 });
        ctx.strokeStyle = '#23823a';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = -1; i <= 1; i += 2) {
            ctx.moveTo(x + i * 6, y - 6);
            ctx.quadraticCurveTo(x + i * 8.5, y, x + i * 6, y + 6);
        }
        ctx.stroke();
    }
    // Grüne Schuppen-Spitzen der Drachenfrucht (ein Pfad)
    _scales(ctx, yy) {
        const S = BossFruitGiant.SCALES;
        ctx.beginPath();
        for (let i = 0; i < S.length; i += 4) {
            const bx = S[i], by = yy + S[i + 1], tx = S[i + 2], ty = yy + S[i + 3];
            const dx = tx - bx, dy = ty - by;
            const l = Math.hypot(dx, dy) || 1;
            const vx = -dy / l * 5, vy = dx / l * 5;
            ctx.moveTo(bx + vx, by + vy);
            ctx.quadraticCurveTo(bx + vx * 0.6 + dx * 0.6, by + vy * 0.6 + dy * 0.6, tx, ty);
            ctx.quadraticCurveTo(bx - vx * 0.6 + dx * 0.6, by - vy * 0.6 + dy * 0.6, bx - vx, by - vy);
            ctx.closePath();
        }
        ctx.fillStyle = '#7ed957';
        ctx.fill();
        ctx.strokeStyle = '#2f7a2a';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    // Saft läuft am Körper herunter (Phase 2)
    _drips(ctx, yy, t) {
        ctx.fillStyle = '#ffc2dc';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const x = -20 + i * 18;
            const y = yy - 10 + ((t * 18 + i * 11) % 30);
            ctx.moveTo(x + 2, y);
            ctx.ellipse(x, y, 2, 3, 0, 0, TAU);
        }
        ctx.fill();
    }
    _banana(ctx, sx, sy, fx, fy, s) {
        const mx = (sx + fx) / 2 + s * 9;
        const my = (sy + fy) / 2 - 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, fx, fy);
        ctx.strokeStyle = Art.ink('#ffd23f');
        ctx.lineWidth = 14.5;
        ctx.stroke();
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 11;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy - 2.5);
        ctx.quadraticCurveTo(mx - 2.5, my - 2.5, fx - 2, fy - 2.5);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
        Art.body(ctx, sx, sy, 4, 4, '#8a5a1c', { lineWidth: 1.4, highlight: false });
    }
    // Erdbeer-Faust
    _berry(ctx, x, y) {
        Art.body(ctx, x, y + 5, 9, 10, '#ff3b4f', { lineWidth: 2 });
        ctx.fillStyle = '#ffe35a';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const px = x + ((i % 3) - 1) * 4.5 + (i > 2 ? 2 : 0);
            const py = y + 3 + (i > 2 ? 6 : 0);
            ctx.moveTo(px + 0.9, py);
            ctx.ellipse(px, py, 0.9, 1.3, 0, 0, TAU);
        }
        ctx.fill();
        Art.star(ctx, x, y - 3, 6, '#4cd964', { points: 5, inner: 0.45, lineWidth: 1.2 });
    }
}
// Schuppen der Drachenfrucht: je Basis (x, y) und Spitze (x, y) relativ zur Körpermitte
BossFruitGiant.SCALES = [
    -28, -18, -37, -30,   28, -18, 37, -30,
    -39, 0, -52, -3,      39, 0, 52, -3,
    -29, 18, -40, 25,     29, 18, 40, 25,
    -13, -2, -17, -12,    13, 6, 17, -4,
    -2, 22, 0, 12,
];

// Extra standard enemies used by the late worlds

// ── Drohne (Welt 2): gelbe Fabrik-Drohne mit Kamera-Auge ──
class Drone extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 18);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 58;
        this.damage = 1;
        this.contactDamage = true;
        this.detectionRange = 260;
        this.shootTimer = 0.6; // erster Schuss mit Ankündigung
        this.hoverPhase = Math.random() * Math.PI * 2;
        this.flying = true;
        this.active = false;
        this.fxColor = '#ffb627';
        this.lookDir = { x: 0, y: 0.3 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.active = dist < this.detectionRange;
        if (!this.active) return;
        const nx = dx / dist;
        const ny = dy / dist;
        this.lookDir.x = nx;
        this.lookDir.y = ny;
        const sway = Math.sin(this.hoverPhase) * 24;
        this.hoverPhase += dt * 5;
        this._moveWithCollision(
            nx * this.speed * dt + Math.cos(this.hoverPhase) * sway * dt,
            ny * this.speed * dt + Math.sin(this.hoverPhase * 0.7) * 8 * dt,
            world
        );
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && typeof Game !== 'undefined') {
            this.shootTimer = 2.2;
            Game.projectiles.push(new Projectile(mx, my, nx * 170, ny * 170, 1, 'enemy', 50));
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const aim = this.active && this.shootTimer < 0.35 && !this.dead; // gleich kommt ein Schuss
        ctx.save();
        ctx.translate(p.x + this.w / 2, p.y + this.h / 2 + Math.sin(t * 4 + this.hoverPhase) * 1.5);
        if (this.dead) {
            // Absturz: trudeln und schrumpfen (G-23)
            const k = this.deathProgress();
            const g = Math.max(0.01, 1 - k * 0.9);
            ctx.translate(0, k * 6);
            ctx.rotate(k * 5);
            ctx.scale(g, g);
        }
        // Landekufen
        ctx.strokeStyle = '#3a3f55';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-4, 4); ctx.lineTo(-6, 9); ctx.lineTo(-8.5, 9);
        ctx.moveTo(4, 4); ctx.lineTo(6, 9); ctx.lineTo(8.5, 9);
        ctx.stroke();
        // Rotor-Arme und Körper
        Art.limb(ctx, -10, -4, 10, -4, 2.2, '#5d6680', { lineWidth: 1 });
        Art.body(ctx, 0, 0, 8.5, 6.5, '#ffb627', { glossy: true });
        ctx.fillStyle = '#2f3448';
        ctx.beginPath();
        ctx.roundRect(-6, 3, 12, 2.4, 1.2);
        ctx.fill();
        // Rotoren: Unschärfe-Scheibe und drehendes Blatt
        for (let side = -1; side <= 1; side += 2) {
            const rx = side * 10;
            const bl = Math.cos(t * 45 + side) * 5.5;
            ctx.fillStyle = 'rgba(230,240,255,0.4)';
            ctx.beginPath();
            ctx.ellipse(rx, -6.5, 5.5, 1.8, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = '#2f3448';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(rx - bl, -6.5);
            ctx.lineTo(rx + bl, -6.5);
            ctx.stroke();
        }
        // Kamera-Auge (glüht rot vor dem Schuss)
        if (aim) Art.glow(ctx, this.lookDir.x * 1.5, -0.5, 14, '#ff3b30', 0.9);
        Art.eye(ctx, 0, -0.5, 4.2, this.lookDir, { iris: aim ? '#ff3b30' : '#2fb6ff', lid: '#1b2238', irisSize: 0.7 });
        // Antenne mit Blinklicht
        Art.limb(ctx, 4, -5, 6, -10, 1, '#5d6680', { outline: false });
        const on = Math.floor(t * 2 + this.hoverPhase) % 2 === 0;
        Art.glow(ctx, 6, -10.5, 5, on ? '#ff4d4d' : '#4dff88', 0.8);
        ctx.fillStyle = on ? '#ff6b6b' : '#6bff9b';
        ctx.beginPath();
        ctx.arc(6, -10.5, 1.4, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
}

// W5 Pilz-Wald: wandelnder Pilz mit Gesicht am Stiel und aufsteigenden Sporen.
// Vor dem Giftschuss bleibt er stehen, bläht den Hut auf und glüht grün (Ankündigung).
class WalkingMushroom extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 22);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 28;
        this.damage = 1;
        this.contactDamage = true;
        this.sporeTimer = 0;
        this.charge = 0;            // > 0: Giftschuss wird angekündigt
        this.wobble = Math.random() * Math.PI * 2;
        this.walk = 0;
        this.chasing = false;
        this.look = { x: 0.4, y: 0.3 };
        this.seed = Math.random() * 10;
        const caps = ['#c65cff', '#ff5aa5', '#8f6bff'];
        this.capColor = caps[randInt(0, caps.length - 1)];
        this.fxColor = this.capColor;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.chasing = dist < 220;
        if (!this.chasing) {
            this.charge = 0;
            return;
        }
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.charge > 0) {
            this.charge -= dt;
            if (this.charge <= 0 && typeof Game !== 'undefined') {
                const p = new Projectile(this.centerX(), this.centerY(), this.look.x * 120, this.look.y * 120, 1, 'enemy', 70);
                p.poison = true;
                Game.projectiles.push(p);
            }
            return;
        }
        this.wobble += dt * 4;
        this.walk += dt * 9;
        this._moveWithCollision(
            this.look.x * this.speed * dt + Math.sin(this.wobble) * 8 * dt,
            this.look.y * this.speed * dt,
            world
        );
        this.sporeTimer -= dt;
        if (this.sporeTimer <= 0 && dist < 120) {
            this.sporeTimer = 2.6;
            this.charge = 0.45;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const fy = pos.y + this.h;
        const t = Art.time;
        const cap = this.capColor;
        const ch = this.charge > 0 && !this.dead ? 1 - this.charge / 0.45 : 0;
        const walking = this.chasing && !this.dead && ch === 0;
        let sx, sy;
        if (this.dead) {
            // Tod: kurz aufploppen, dann zusammenschnurren
            const d = this.deathProgress();
            const k = d < 0.3 ? 1 + d : Math.max(0.01, 1.3 * (1 - (d - 0.3) / 0.7));
            sx = k * 1.12;
            sy = k * 0.9;
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        } else {
            const s = walking ? Math.abs(Math.sin(this.walk)) * 0.09 - 0.04 : Math.sin(t * 2.6 + this.seed) * 0.03;
            sx = 1 + s + ch * 0.06;
            sy = 1 - s + ch * 0.1;
        }
        ctx.save();
        ctx.translate(cx, fy);
        ctx.scale(sx, sy);
        // Füßchen, abwechselnd angehoben
        const st = walking ? Math.sin(this.walk) : 0;
        Art.body(ctx, -5, -2 - Math.max(0, st) * 2.5, 3.8, 2.5, '#f2c690', { highlight: false });
        Art.body(ctx, 5, -2 - Math.max(0, -st) * 2.5, 3.8, 2.5, '#f2c690', { highlight: false });
        // Stiel mit Gesicht
        Art.body(ctx, 0, -8.5, 8.6, 7.8, '#fff0d2');
        if (this.dead) {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-5, -10.7); ctx.lineTo(-1.6, -7.3);
            ctx.moveTo(-1.6, -10.7); ctx.lineTo(-5, -7.3);
            ctx.moveTo(1.6, -10.7); ctx.lineTo(5, -7.3);
            ctx.moveTo(5, -10.7); ctx.lineTo(1.6, -7.3);
            ctx.stroke();
        } else {
            Art.eyes(ctx, 0, -9, 2.5, { gap: 3.3, look: this.look, seed: this.seed, angry: this.chasing });
        }
        Art.mouth(ctx, 0, -4.4, 4.4, this.dead || ch > 0 ? 'o' : (this.chasing ? 'grin' : 'smile'));
        Art.blush(ctx, 0, -5.8, 1.6, 5.9);
        // Hut, bläht sich beim Ankündigen auf
        ctx.translate(0, -14);
        const cs = 1 + ch * 0.16;
        ctx.scale(cs, cs);
        if (ch > 0) Art.glow(ctx, 0, -4, 17 + ch * 6, '#9dff5a', 0.35 + ch * 0.55);
        Art.shape(ctx, c => {
            c.moveTo(-15.5, 1.5);
            c.bezierCurveTo(-16.5, -14, 16.5, -14, 15.5, 1.5);
            c.quadraticCurveTo(0, 4.5, -15.5, 1.5);
            c.closePath();
        }, { x: -16, y: -12, w: 32, h: 15 }, cap);
        ctx.fillStyle = Art.light(cap, 0.7);
        ctx.beginPath();
        ctx.moveTo(-4, -4.5); ctx.ellipse(-7, -4.5, 3, 2.2, 0, 0, TAU);
        ctx.moveTo(6.4, -8.2); ctx.ellipse(4, -8.2, 2.4, 1.8, 0, 0, TAU);
        ctx.moveTo(11.2, -2); ctx.ellipse(9.2, -2, 2, 1.5, 0, 0, TAU);
        ctx.fill();
        Art.shine(ctx, -6, -7.6, 3.6, 1.5, -0.35, 0.5);
        // Sporen steigen auf
        if (!this.dead) {
            for (let i = 0; i < 2; i++) {
                const ph = (t * 0.45 + this.seed * 0.37 + i * 0.5) % 1;
                Art.glow(ctx, Math.sin(ph * 5 + i * 2 + this.seed) * 7 + (i ? 5 : -5), -12 - ph * 12, 3.4, '#e9b8ff', Math.sin(ph * Math.PI) * 0.9);
            }
        }
        ctx.restore();
    }
}

// W6 Mücken-Sumpf: lila Mücke mit großen Augen, Rüssel und schwirrenden Flügeln.
// Sturzflug als Zustand (G-18): erst zurückziehen und zittern, Rüssel glüht rot (Ankündigung),
// dann 0,35 s vorschießen, mit Wandkollision.
class SwampMosquito extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 16);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 72;
        this.damage = 1;
        this.contactDamage = true;
        this.detectionRange = 280;
        this.diveTimer = 0;
        this.wingPhase = Math.random() * Math.PI * 2;
        this.flying = true;
        this.fxColor = '#a45cff';
        this.look = { x: 0.6, y: 0.3 };   // Blickrichtung im Körper-System (x > 0 = nach vorn)
        this.face = 1;                     // 1 schaut nach rechts, -1 nach links
        this.seed = Math.random() * 10;
        this.dive = 0;                     // 0 fliegt, 1 Ankündigung, 2 Sturzflug
        this.diveT = 0;
        this.diveA = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        if (this.dive === 1) {
            // Anlauf: kurz zurückweichen
            this.diveT -= dt;
            this._moveWithCollision(-Math.cos(this.diveA) * 30 * dt, -Math.sin(this.diveA) * 30 * dt, world);
            if (this.diveT <= 0) {
                this.dive = 2;
                this.diveT = 0.35;
            }
            return;
        }
        if (this.dive === 2) {
            this.diveT -= dt;
            const mx = Math.cos(this.diveA) * 140 * dt;
            const my = Math.sin(this.diveA) * 140 * dt;
            const bx = this.x;
            const by = this.y;
            this._moveWithCollision(mx, my, world);
            // An einer Wand endet der Sturzflug
            const blocked = Math.abs(this.x - bx - mx) + Math.abs(this.y - by - my) > (Math.abs(mx) + Math.abs(my)) * 0.5;
            if (this.diveT <= 0 || blocked) this.dive = 0;
            return;
        }
        if (dist >= this.detectionRange) return;
        if (dx > dist * 0.15) this.face = 1;
        else if (dx < -dist * 0.15) this.face = -1;
        this.look.x = dx / dist * this.face;
        this.look.y = dy / dist;
        this.wingPhase += dt * 16;
        this._moveWithCollision(
            dx / dist * this.speed * dt + Math.cos(this.wingPhase) * 10 * dt,
            dy / dist * this.speed * dt + Math.sin(this.wingPhase * 1.2) * 6 * dt,
            world
        );
        this.diveTimer -= dt;
        if (this.diveTimer <= 0 && dist < 130) {
            this.diveTimer = 1.7;
            this.dive = 1;
            this.diveT = 0.3;
            this.diveA = Math.atan2(dy, dx);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const body = '#a45cff';
        let k = 1, rot = 0, jx = 0;
        if (this.dead) {
            // Tod: trudeln und zusammenschrumpfen
            const d = this.deathProgress();
            k = d < 0.25 ? 1 + d * 0.8 : Math.max(0.01, 1.2 * (1 - (d - 0.25) / 0.75));
            rot = d * 6;
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        } else if (this.dive === 1) {
            rot = -0.35;
            jx = Math.sin(t * 95) * 0.9;
        } else if (this.dive === 2) {
            rot = 0.35;
        }
        const hover = this.dead ? 0 : Math.sin(t * 7 + this.seed) * 1.6;
        const A = ctx.globalAlpha;
        ctx.save();
        ctx.translate(cx + jx, cy + hover);
        ctx.scale(this.face * k, k);
        ctx.rotate(rot);
        // Flügel: Unschärfe-Fächer und zwei durchsichtige Flügel (sehr schneller Schlag)
        const fa = -1.25 + Math.sin(t * 62 + this.seed) * 0.45;
        ctx.globalAlpha = A * 0.28;
        ctx.fillStyle = '#e4f8ff';
        ctx.beginPath();
        ctx.moveTo(-1, -3.5);
        ctx.arc(-1, -3.5, 11.5, -2.25, -0.45);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = A * 0.85;
        ctx.fillStyle = 'rgba(226,248,255,0.75)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 2; i++) {
            const a = fa - i * 0.45;
            const wx = -1 + Math.cos(a) * 6;
            const wy = -3.5 + Math.sin(a) * 6;
            ctx.moveTo(wx + Math.cos(a) * 6.5, wy + Math.sin(a) * 6.5);
            ctx.ellipse(wx, wy, 6.5, 2.5, a, 0, TAU);
        }
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = A;
        // Beinchen baumeln
        const sw = Math.sin(t * 5 + this.seed) * 0.8;
        ctx.strokeStyle = '#4a2396';
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-2.5, 2); ctx.lineTo(-5 + sw, 5.5); ctx.lineTo(-6 + sw, 8.5);
        ctx.moveTo(0.5, 2.5); ctx.lineTo(sw, 6.5); ctx.lineTo(1 + sw, 9);
        ctx.moveTo(3, 2); ctx.lineTo(5 + sw, 5); ctx.lineTo(6.5 + sw, 7.5);
        ctx.stroke();
        // Hinterleib mit Streifen, Brust, Kopf
        Art.body(ctx, -6.5, 1.8, 6.6, 3.9, body, { rot: 0.38 });
        ctx.strokeStyle = '#efd9ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-10.3, 3.3); ctx.lineTo(-8.3, -1.9);
        ctx.moveTo(-7.1, 4.9); ctx.lineTo(-4.8, -0.9);
        ctx.stroke();
        Art.body(ctx, 0, -0.5, 4.4, 4, '#8a4ae8');
        Art.body(ctx, 5.2, -2.8, 4.4, 4, body);
        // Fühler
        ctx.strokeStyle = '#4a2396';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(4.5, -6.4); ctx.quadraticCurveTo(5, -9, 3.4, -10.4);
        ctx.moveTo(6.8, -6.3); ctx.quadraticCurveTo(8.2, -8.8, 7.9, -10.8);
        ctx.stroke();
        // Rüssel zeigt zu Mark, glüht vor dem Sturzflug
        const na = clamp(Math.atan2(this.look.y, Math.max(0.2, this.look.x)), -0.5, 1.1);
        const nx = 9 + Math.cos(na) * 8;
        const ny = -1.5 + Math.sin(na) * 8;
        Art.limb(ctx, 8.6, -1.6, nx, ny, 1.1, '#7a2446', { lineWidth: 0.8 });
        if (this.dive === 1) Art.glow(ctx, nx, ny, 6, '#ff4d6d', 0.95);
        if (this.dead) {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(2.4, -5); ctx.lineTo(5, -2.4);
            ctx.moveTo(5, -5); ctx.lineTo(2.4, -2.4);
            ctx.moveTo(6.8, -5); ctx.lineTo(9.4, -2.4);
            ctx.moveTo(9.4, -5); ctx.lineTo(6.8, -2.4);
            ctx.stroke();
        } else {
            Art.eyes(ctx, 6, -3.6, 1.9, { gap: 2.3, look: this.look, angry: true, seed: this.seed });
        }
        // Tempo-Striche im Sturzflug
        if (this.dive === 2) {
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-14, -3); ctx.lineTo(-21, -3.5);
            ctx.moveTo(-13, 3.5); ctx.lineTo(-19, 4.5);
            ctx.stroke();
        }
        ctx.restore();
    }
}

// W6 Schlüsselträger: Krokodil-Kind. Grün, Glubschaugen oben auf dem Kopf, wedelnder Schwanz,
// goldener Schlüssel schwebt über ihm. Vor dem Giftspucken hebt es den Kopf, reißt das Maul auf
// und ein grüner Tropfen leuchtet (Ankündigung).
class CrocodileKid extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 22);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 42;
        this.damage = 2;
        this.contactDamage = true;
        this.spitTimer = 0;
        this.charge = 0;            // > 0: Spucken wird angekündigt
        this.isKeyGhost = true;
        this.droppedKey = false;
        this.look = { x: 0.7, y: 0.2 };   // Blickrichtung im Körper-System (x > 0 = nach vorn)
        this.face = 1;
        this.walk = 0;
        this.chasing = false;
        this.seed = Math.random() * 10;
        this.fxColor = '#4fc95f';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.chasing = dist < 220;
        if (!this.chasing) {
            this.charge = 0;
            return;
        }
        if (dx > dist * 0.15) this.face = 1;
        else if (dx < -dist * 0.15) this.face = -1;
        this.look.x = dx / dist * this.face;
        this.look.y = dy / dist;
        if (this.charge > 0) {
            this.charge -= dt;
            if (this.charge <= 0 && typeof Game !== 'undefined') {
                const p = new Projectile(this.centerX(), this.centerY(), dx / dist * 135, dy / dist * 135, 1, 'enemy', 60);
                p.poison = true;
                Game.projectiles.push(p);
            }
            return;
        }
        this.walk += dt * 8;
        this._moveWithCollision(dx / dist * this.speed * dt, dy / dist * this.speed * dt, world);
        this.spitTimer -= dt;
        if (this.spitTimer <= 0 && dist < 150) {
            this.spitTimer = 2.4;
            this.charge = 0.45;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const fy = pos.y + this.h;
        const t = Art.time;
        const green = '#4fc95f';
        const dark = '#35a24a';
        const ch = this.charge > 0 && !this.dead ? 1 - this.charge / 0.45 : 0;
        const walking = this.chasing && !this.dead && ch === 0;
        let k = 1, rot = 0;
        if (this.dead) {
            // Tod: hüpft hoch, kippt und schrumpft
            const d = this.deathProgress();
            k = d < 0.3 ? 1 + d * 0.7 : Math.max(0.01, 1.21 * (1 - (d - 0.3) / 0.7));
            rot = -d * 0.6;
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        }
        const st = walking ? Math.sin(this.walk) : 0;
        const bounce = walking ? Math.abs(st) * 1.2 : 0;
        ctx.save();
        ctx.translate(cx, fy);
        ctx.scale(this.face * k, k);
        ctx.rotate(rot);
        // Beine (hinten dunkler), der Bauch liegt darauf
        Art.body(ctx, -3, -2.4 - Math.max(0, -st) * 1.8, 2.6, 2.4, dark, { highlight: false });
        Art.body(ctx, 8, -2.4 - Math.max(0, st) * 1.8, 2.6, 2.4, dark, { highlight: false });
        Art.body(ctx, -6.5, -2 - Math.max(0, st) * 2, 2.9, 2.6, green, { highlight: false });
        Art.body(ctx, 4.5, -2 - Math.max(0, -st) * 2, 2.9, 2.6, green, { highlight: false });
        ctx.translate(0, -bounce);
        // Schwanz wedelt
        const wag = Math.sin(t * 4 + this.seed) * 2.2;
        Art.shape(ctx, c => {
            c.moveTo(-7, -12);
            c.quadraticCurveTo(-15, -11 + wag * 0.5, -21, -6 + wag);
            c.quadraticCurveTo(-15, -3.5 + wag * 0.3, -7, -4);
            c.closePath();
        }, { x: -21, y: -12, w: 14, h: 9 }, green);
        // Rückenzacken (unter dem Körper, nur die Spitzen schauen heraus)
        ctx.fillStyle = dark;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const bx = -6.5 + i * 4;
            ctx.moveTo(bx - 1.9, -13); ctx.lineTo(bx, -16.2); ctx.lineTo(bx + 1.9, -13);
        }
        ctx.fill();
        // Körper mit hellem Bauch
        Art.body(ctx, -1, -8, 9.8, 6.2, green);
        ctx.fillStyle = '#d8f7a2';
        ctx.beginPath();
        ctx.ellipse(0, -4.6, 7, 2.3, 0, 0, TAU);
        ctx.fill();
        // Kopf mit Schnauze (hebt sich vor dem Spucken)
        ctx.translate(4, -10);
        ctx.rotate(-ch * 0.28);
        ctx.translate(-4, 10);
        Art.shape(ctx, c => {
            c.moveTo(3, -9);
            c.bezierCurveTo(2.5, -17, 11, -18.5, 13.5, -13.5);
            c.quadraticCurveTo(20, -13, 21, -9.5);
            c.quadraticCurveTo(21.5, -6, 17.5, -5.5);
            c.lineTo(8.5, -5.5);
            c.quadraticCurveTo(3, -5.5, 3, -9);
            c.closePath();
        }, { x: 3, y: -18, w: 19, h: 12.5 }, green);
        // Maul: Lächeln mit Zähnchen oder weit offen mit Gifttropfen
        if (ch > 0) {
            ctx.fillStyle = '#6a1636';
            ctx.beginPath();
            ctx.moveTo(21, -7.6); ctx.lineTo(9.5, -8.4); ctx.lineTo(19.5, -3.8 - ch);
            ctx.closePath();
            ctx.fill();
            Art.glow(ctx, 22.8, -7.6, 5 + ch * 6, '#9dff5a', 0.45 + ch * 0.55);
            Art.body(ctx, 22.8, -7.6, 1.2 + ch * 1.6, 1.2 + ch * 1.6, '#8dff4a', { highlight: false, lineWidth: 0.8 });
        } else {
            ctx.strokeStyle = '#1f5a2a';
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(20.3, -7.4); ctx.quadraticCurveTo(14, -6.2, 9.2, -8.6);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(15, -6.9); ctx.lineTo(16.8, -6.8); ctx.lineTo(15.9, -5.2);
            ctx.moveTo(11.4, -7.3); ctx.lineTo(13.1, -7.1); ctx.lineTo(12.1, -5.7);
            ctx.fill();
        }
        // Nasenlöcher und Wange
        ctx.fillStyle = '#1f5a2a';
        ctx.beginPath();
        ctx.moveTo(19.7, -10.6); ctx.arc(19.1, -10.6, 0.6, 0, TAU);
        ctx.moveTo(17.7, -11.1); ctx.arc(17.1, -11.1, 0.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,122,168,0.45)';
        ctx.beginPath();
        ctx.ellipse(10, -9.5, 2, 1.2, 0, 0, TAU);
        ctx.fill();
        // Glubschaugen auf dem Kopf
        ctx.fillStyle = green;
        ctx.strokeStyle = Art.ink(green);
        ctx.lineWidth = Art.LINE;
        ctx.beginPath();
        ctx.moveTo(9, -16.6); ctx.arc(5.7, -16.6, 3.3, 0, TAU);
        ctx.moveTo(14.8, -16.6); ctx.arc(11.5, -16.6, 3.3, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (this.dead) {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(4.2, -18.6); ctx.lineTo(7.2, -15.6);
            ctx.moveTo(7.2, -18.6); ctx.lineTo(4.2, -15.6);
            ctx.moveTo(10, -18.6); ctx.lineTo(13, -15.6);
            ctx.moveTo(13, -18.6); ctx.lineTo(10, -15.6);
            ctx.stroke();
        } else {
            Art.eyes(ctx, 8.6, -17.1, 2.6, { gap: 2.9, look: this.look, seed: this.seed, angry: this.chasing });
        }
        ctx.restore();
        // Schlüssel schwebt über dem Kopf (nicht gespiegelt)
        if (this.isKeyGhost && !this.dead) {
            const ky = fy - 30 + Math.sin(t * 3 + this.seed) * 1.5;
            Art.glow(ctx, cx, ky, 12, '#ffd23f', 0.6);
            // verkleinert zeichnen, damit der Umriss fein bleibt
            ctx.save();
            ctx.translate(cx - 1, ky);
            ctx.rotate(-0.45);
            ctx.scale(0.55, 0.55);
            Art.key(ctx, -2.5, 0, 8.5, '#ffd23f');
            ctx.restore();
            Art.sparkle(ctx, cx + 6, ky - 5, 1.8 + Math.sin(t * 5 + this.seed) * 0.8, '#ffffff', 0.9);
        }
    }
}

// W7 Antarktis: Eis-Pinguin mit Pudelmütze. Watschelt und schießt einen Eisstrahl, der Mark bremst.
// Ankündigung: lehnt sich zurück, Flossen hoch, Schnabel auf, vor dem Schnabel wächst ein Eiskristall.
class IcePenguin extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 46;
        this.damage = 1;
        this.contactDamage = true;
        this.shootTimer = 0;
        this.charge = 0;            // > 0: Eisstrahl wird angekündigt
        this.look = { x: 0.3, y: 0.4 };
        this.walk = 0;
        this.chasing = false;
        this.seed = Math.random() * 10;
        const hats = ['#ff4d6d', '#ffc83d', '#3ddc97', '#ff8a3d', '#c77dff'];
        this.hat = hats[randInt(0, hats.length - 1)];
        this.fxColor = '#7fd8ff';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.chasing = dist < 240;
        if (!this.chasing) {
            this.charge = 0;
            return;
        }
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.charge > 0) {
            this.charge -= dt;
            if (this.charge <= 0 && typeof Game !== 'undefined') {
                // Eisgeschoss: bremst Mark (slow) und wird als Eis gezeichnet (isIce)
                const p = new Projectile(this.centerX(), this.centerY(), this.look.x * 140, this.look.y * 140, 1, 'enemy', 55);
                p.slow = true;
                p.isIce = true;
                Game.projectiles.push(p);
            }
            return;
        }
        this.walk += dt * 10;
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = 2.8;
            this.charge = 0.5;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const fy = pos.y + this.h;
        const t = Art.time;
        const blue = '#3563c9';
        const white = '#f6fbff';
        const ch = this.charge > 0 && !this.dead ? 1 - this.charge / 0.5 : 0;
        const walking = this.chasing && !this.dead && ch === 0;
        let k = 1, rot;
        if (this.dead) {
            // Tod: kippt um und schrumpft
            const d = this.deathProgress();
            k = d < 0.3 ? 1 + d * 0.6 : Math.max(0.01, 1.18 * (1 - (d - 0.3) / 0.7));
            rot = d * 1.1;
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        } else if (walking) {
            rot = Math.sin(this.walk) * 0.14;       // Watscheln
        } else {
            rot = Math.sin(t * 1.8 + this.seed) * 0.05 - ch * 0.14;
        }
        ctx.save();
        ctx.translate(cx, fy);
        ctx.rotate(rot);
        ctx.scale(k, k);
        // Füße
        const st = walking ? Math.sin(this.walk) : 0;
        Art.body(ctx, -4.2, -1.4 - Math.max(0, st) * 2, 3.6, 2, '#ff9d2e', { highlight: false });
        Art.body(ctx, 4.2, -1.4 - Math.max(0, -st) * 2, 3.6, 2, '#ff9d2e', { highlight: false });
        // Flossen (flattern beim Laufen, gehen vor dem Schuss hoch)
        const fl = walking ? Math.sin(this.walk * 2) * 0.3 : Math.sin(t * 2 + this.seed) * 0.08;
        Art.body(ctx, -9.2, -9.8, 2.6, 5.6, blue, { rot: 0.4 + fl + ch * 0.7, highlight: false });
        Art.body(ctx, 9.2, -9.8, 2.6, 5.6, blue, { rot: -0.4 - fl - ch * 0.7, highlight: false });
        // Körper, Bauch und Gesichtsmaske
        Art.body(ctx, 0, -11.5, 9.6, 11.5, blue, { highlight: false });
        Art.shine(ctx, -6.4, -13, 1.6, 3.4, 0.25, 0.45);
        ctx.fillStyle = white;
        ctx.beginPath();
        ctx.ellipse(0, -7.8, 6.6, 7.2, 0, 0, TAU);
        ctx.moveTo(6.4, -14.6); ctx.arc(2.8, -14.6, 3.6, 0, TAU);
        ctx.moveTo(0.8, -14.6); ctx.arc(-2.8, -14.6, 3.6, 0, TAU);
        ctx.fill();
        // Augen, Wangen, Schnabel
        if (this.dead) {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-4.4, -16.2); ctx.lineTo(-1.4, -13.2);
            ctx.moveTo(-1.4, -16.2); ctx.lineTo(-4.4, -13.2);
            ctx.moveTo(1.4, -16.2); ctx.lineTo(4.4, -13.2);
            ctx.moveTo(4.4, -16.2); ctx.lineTo(1.4, -13.2);
            ctx.stroke();
        } else {
            Art.eyes(ctx, 0, -14.7, 2.1, { gap: 2.9, look: this.look, seed: this.seed, angry: this.chasing });
        }
        Art.blush(ctx, 0, -11.4, 1.5, 5.3);
        const bx = this.look.x * 1.3;
        ctx.fillStyle = '#ff9d2e';
        ctx.strokeStyle = '#a4520e';
        ctx.lineWidth = 0.8;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (ch > 0) {
            // Schnabel auf
            ctx.moveTo(bx - 2.3, -12.6); ctx.lineTo(bx + 2.3, -12.6); ctx.lineTo(bx, -11.2 - ch);
            ctx.closePath();
            ctx.moveTo(bx - 1.8, -10.4 + ch * 0.3); ctx.lineTo(bx + 1.8, -10.4 + ch * 0.3); ctx.lineTo(bx, -8.6 + ch * 0.6);
            ctx.closePath();
        } else {
            ctx.moveTo(bx - 2.3, -12.4); ctx.lineTo(bx + 2.3, -12.4); ctx.lineTo(bx, -9.8);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        // Pudelmütze
        Art.shape(ctx, c => {
            c.moveTo(-7.2, -19.4);
            c.bezierCurveTo(-7.4, -28, 7.4, -28, 7.2, -19.4);
            c.closePath();
        }, { x: -7.4, y: -26, w: 14.8, h: 7 }, this.hat);
        Art.box(ctx, -7.8, -20.8, 15.6, 3.2, 1.6, white, { highlight: false, outline: '#8aa4c8', lineWidth: 1 });
        Art.body(ctx, 0, -26.4, 2.6, 2.6, white, { outline: '#8aa4c8', lineWidth: 1 });
        ctx.restore();
        // Eiskristall wächst vor dem Schnabel (Ankündigung des Eisstrahls)
        if (ch > 0) {
            const ix = cx + this.look.x * 9;
            const iy = fy - 11 + this.look.y * 5;
            Art.glow(ctx, ix, iy, 6 + ch * 8, '#7fe3ff', 0.4 + ch * 0.6);
            Art.sparkle(ctx, ix, iy, 1.5 + ch * 4, '#ffffff', 0.95);
        }
    }
}

// W8 Vulkan-Insel: hüpfende Lava-Kugel mit Glutrissen, Flämmchen und Hitzeflimmern.
// Vor den vier Lavaspritzern bleibt sie stehen, bläht sich auf und glüht gelb (Ankündigung).
class LavaBall extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 20);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 62;
        this.damage = 1;
        this.contactDamage = true;
        this.burnTimer = 0;
        this.charge = 0;            // > 0: Spritzer werden angekündigt
        this.pulse = Math.random() * Math.PI * 2;
        this.hop = 0;
        this.chasing = false;
        this.look = { x: 0.3, y: 0.4 };
        this.seed = Math.random() * 10;
        this.fxColor = '#ff7a1a';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.chasing = dist < 240;
        if (!this.chasing) {
            this.charge = 0;
            return;
        }
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.charge > 0) {
            this.charge -= dt;
            if (this.charge <= 0 && typeof Game !== 'undefined') {
                for (let i = 0; i < 4; i++) {
                    const sa = (Math.PI * 2 * i) / 4;
                    Game.projectiles.push(new Projectile(this.centerX(), this.centerY(), Math.cos(sa) * 110, Math.sin(sa) * 110, 1, 'enemy', 45));
                }
            }
            return;
        }
        this.pulse += dt * 10;
        this.hop += dt * 4;
        this._moveWithCollision(
            this.look.x * this.speed * dt + Math.cos(this.pulse) * 12 * dt,
            this.look.y * this.speed * dt + Math.sin(this.pulse) * 12 * dt,
            world
        );
        this.burnTimer -= dt;
        if (this.burnTimer <= 0 && dist < 120) {
            this.burnTimer = 2.0;
            this.charge = 0.4;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const ch = this.charge > 0 && !this.dead ? 1 - this.charge / 0.4 : 0;
        let k = 1;
        if (this.dead) {
            // Tod: grell aufblähen, dann zerplatzen
            const d = this.deathProgress();
            k = d < 0.35 ? 1 + d * 0.9 : Math.max(0.01, 1.32 * (1 - (d - 0.35) / 0.65));
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        }
        const A = ctx.globalAlpha;
        // Hüpfen: oben leicht, am Boden gestaucht (Schatten bleibt am Boden)
        const h = this.dead || ch > 0 ? 0.35 : Math.abs(Math.sin(this.hop + t * 3 + this.seed));
        const lift = h * 4.5;
        const sq = Math.max(0, 0.3 - h) / 0.3 * 0.15;
        const jx = ch > 0 ? Math.sin(t * 80) * 0.7 * ch : 0;
        const sw = 1 + ch * 0.22;
        ctx.save();
        ctx.translate(cx + jx, cy + 10 - lift);
        ctx.scale((1 + sq) * sw * k, (1 - sq) * sw * k);
        ctx.translate(0, -10);
        // Hitzeflimmern: zwei wellige Schlieren steigen auf
        ctx.strokeStyle = '#ffd9a0';
        ctx.lineWidth = 1.1;
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
            const ph = (t * 0.9 + i * 0.5 + this.seed * 0.1) % 1;
            const y0 = -14 - ph * 12;
            const x0 = i ? 3.5 : -3.5;
            const w = Math.sin(t * 7 + i * 2) * 2;
            ctx.globalAlpha = A * Math.sin(ph * Math.PI) * 0.5;
            ctx.beginPath();
            ctx.moveTo(x0, y0 + 5);
            ctx.quadraticCurveTo(x0 + w, y0 + 2.5, x0, y0);
            ctx.quadraticCurveTo(x0 - w, y0 - 2.5, x0, y0 - 5);
            ctx.stroke();
        }
        ctx.globalAlpha = A;
        // Glut und Flämmchen auf dem Kopf
        Art.glow(ctx, 0, 0, 19 + ch * 9, '#ff7a1a', 0.5 + Math.sin(t * 6 + this.seed) * 0.12 + ch * 0.4);
        ctx.fillStyle = ch > 0.5 ? '#fff0a0' : '#ffcc33';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            const fh = 5.5 + Math.sin(t * 13 + i * 2.1 + this.seed) * 1.6 + (i === 0 ? 2.5 : 0) + ch * 4;
            const fx = i * 4.2;
            ctx.moveTo(fx - 2.6, -7);
            ctx.quadraticCurveTo(fx - 1.6, -7 - fh * 0.7, fx + Math.sin(t * 9 + i) * 1.2, -7 - fh);
            ctx.quadraticCurveTo(fx + 1.6, -7 - fh * 0.7, fx + 2.6, -7);
        }
        ctx.fill();
        // Kugel mit dunklen Krustenschuppen
        Art.body(ctx, 0, 0, 10, 10, ch > 0.5 ? '#ffae1a' : '#ff6a1a', { glossy: true });
        ctx.fillStyle = 'rgba(128,36,14,0.8)';
        ctx.beginPath();
        ctx.moveTo(8.2, 4.6); ctx.ellipse(5.2, 4.6, 3, 2, -0.5, 0, TAU);
        ctx.moveTo(-3.4, 5.8); ctx.ellipse(-5.6, 5.8, 2.2, 1.6, 0.4, 0, TAU);
        ctx.moveTo(2.9, 8); ctx.ellipse(1.2, 8, 1.7, 1.1, 0, 0, TAU);
        ctx.fill();
        // Freches Gesicht
        if (this.dead) {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-4.8, -3.8); ctx.lineTo(-1.8, -0.8);
            ctx.moveTo(-1.8, -3.8); ctx.lineTo(-4.8, -0.8);
            ctx.moveTo(1.8, -3.8); ctx.lineTo(4.8, -0.8);
            ctx.moveTo(4.8, -3.8); ctx.lineTo(1.8, -0.8);
            ctx.stroke();
        } else {
            Art.eyes(ctx, 0, -2.2, 2.4, { gap: 3.2, look: this.look, angry: true, seed: this.seed });
        }
        Art.mouth(ctx, 0, 3, 5.6, this.dead || ch > 0 ? 'open' : 'teeth');
        ctx.restore();
        // Glutfunken steigen auf
        if (!this.dead) {
            for (let i = 0; i < 2; i++) {
                const ph = (t * 0.7 + i * 0.5 + this.seed * 0.23) % 1;
                Art.glow(ctx, cx + Math.sin(ph * 6 + i * 3 + this.seed) * 8, cy - 8 - ph * 16, 2.6, '#ffd23f', Math.sin(ph * Math.PI));
            }
        }
    }
}

// Mini-T-Rex (Welt 17): klein und niedlich; duckt sich kurz und springt dann vor (G-18).
class MiniTRex extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 22);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 60;
        this.damage = 1;
        this.contactDamage = true;
        this.fxColor = '#78d64b';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.face = 1;
        this.lungeTimer = 0;
        this.state = 'walk';     // walk → crouch (Ankündigung) → lunge
        this.stateT = 0;
        this.lungeA = 0;
        this.walkT = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.state === 'crouch') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'lunge';
                this.stateT = 0.3;
            }
            return;
        }
        if (this.state === 'lunge') {
            // Vorsprung mit Wand-Kollision (Lauf- plus Sprungtempo)
            const v = this.speed + 130;
            const sx = Math.cos(this.lungeA) * v * dt, sy = Math.sin(this.lungeA) * v * dt;
            const ox = this.x, oy = this.y;
            this._moveWithCollision(sx, sy, world);
            this.stateT -= dt;
            const moved = Math.abs(this.x - ox) + Math.abs(this.y - oy);
            if (this.stateT <= 0 || moved < (Math.abs(sx) + Math.abs(sy)) * 0.4) this.state = 'walk';
            return;
        }
        if (dx > 3) this.face = 1; else if (dx < -3) this.face = -1;
        if (dist < 220) {
            this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
            this.walkT += dt;
            this.lungeTimer -= dt;
            if (this.lungeTimer <= 0 && dist < 120) {
                this.lungeTimer = 2.5;
                this.state = 'crouch';
                this.stateT = 0.3;
                this.lungeA = Math.atan2(dy, dx);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const f = this.face;
        const lk = this.look;
        const st = this.state;
        const col = '#78d64b';
        const ink = Art.ink(col);
        const k = st === 'crouch' ? 1 - this.stateT / 0.3 : 0;
        if (st === 'crouch') LateWorldArt.chevrons(ctx, cx, cy, this.lungeA, k);
        if (st === 'lunge') LateWorldArt.speedLines(ctx, cx, cy - 3, this.lungeA, 11, 4);
        const run = st === 'walk' ? Math.sin(this.walkT * 16) : 0;
        const hop = st === 'walk' ? Math.abs(run) * 1.2 : (st === 'lunge' ? 3 : 0);
        const sq = st === 'crouch' ? 0.14 * Math.min(1, k * 2.5) : (st === 'lunge' ? -0.08 : 0);
        ctx.translate(cx, by);
        ctx.scale(1 + sq, 1 - sq);
        ctx.translate(0, -hop);
        // hinteres Bein
        this._leg(ctx, -2.5 * f, (-2.5 + run * 2.4) * f, Math.max(0, run) * 1.5, Art.dark(col, 0.18), f);
        // Rückenzacken (hinter Körper und Kopf)
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const x = (3 - i * 3.6) * f, y = -21.5 + i * 2.2;
            ctx.moveTo(x - 2 * f, y + 1.6);
            ctx.lineTo(x - 1.6 * f, y - 3.6);
            ctx.lineTo(x + 2.1 * f, y + 1.6);
            ctx.closePath();
        }
        ctx.fillStyle = '#ffb020';
        ctx.fill();
        ctx.strokeStyle = Art.ink('#ffb020');
        ctx.lineWidth = 1;
        ctx.lineJoin = 'round';
        ctx.stroke();
        // Schwanz
        const wag = Math.sin(t * 7 + this.seed) * 1.5 - (st === 'crouch' ? 3 : 0);
        ctx.beginPath();
        ctx.moveTo(-4 * f, -13);
        ctx.quadraticCurveTo(-12 * f, -13 + wag * 0.5, -17.5 * f, -15.5 + wag);
        ctx.quadraticCurveTo(-12 * f, -7.5, -4 * f, -6);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // Körper mit gelbem Bauch
        Art.body(ctx, -1 * f, -9.5, 8.6, 7.2, col);
        ctx.fillStyle = '#fff27a';
        ctx.beginPath();
        ctx.ellipse(2 * f, -7.6, 4.4, 4, 0, 0, TAU);
        ctx.fill();
        // vorderes Bein und Ärmchen
        this._leg(ctx, 2.5 * f, (2.5 - run * 2.4) * f, Math.max(0, -run) * 1.5, col, f);
        Art.limb(ctx, 5.5 * f, -10.5, 8.2 * f, st === 'lunge' ? -11 : -8.6, 1.7, col, { lineWidth: 1.1 });
        // großer runder Kopf
        const hx = 6.5 * f, hy = -16.5;
        Art.body(ctx, hx, hy, 7.8, 6.6, col);
        const jaw = st === 'lunge' ? 1 : (k > 0 ? 0.4 : 0);
        if (jaw > 0 && !this.dead) {
            ctx.fillStyle = '#7a1f3d';
            ctx.beginPath();
            ctx.moveTo(hx + 1 * f, hy + 2);
            ctx.lineTo(hx + 8.6 * f, hy + 0.6);
            ctx.lineTo(hx + 7.4 * f, hy + 2.6 + jaw * 3.4);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(hx + 4 * f, hy + 1.5);
            ctx.lineTo(hx + 4.8 * f, hy + 3);
            ctx.lineTo(hx + 5.6 * f, hy + 1.3);
            ctx.moveTo(hx + 6.6 * f, hy + 1.1);
            ctx.lineTo(hx + 7.3 * f, hy + 2.5);
            ctx.lineTo(hx + 8 * f, hy + 0.9);
            ctx.fill();
        } else {
            // freches Grinsen mit Zähnchen
            ctx.strokeStyle = ink;
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(hx + 1.2 * f, hy + 2.2);
            ctx.quadraticCurveTo(hx + 5 * f, hy + 4.4, hx + 8.3 * f, hy + 1);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(hx + 5.6 * f, hy + 3.2);
            ctx.lineTo(hx + 6.3 * f, hy + 4.6);
            ctx.lineTo(hx + 7 * f, hy + 2.6);
            ctx.fill();
        }
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(hx + 6.4 * f, hy - 2, 0.7, 0, TAU);
        ctx.fill();
        if (this.dead) LateWorldArt.xEyes(ctx, hx + 0.5 * f, hy - 1.8, 1.5, 2.5);
        else Art.eyes(ctx, hx + 0.5 * f + lk.x * 0.5, hy - 1.8, 2.1, { gap: 2.5, look: lk, seed: this.seed, angry: st !== 'walk' });
        Art.blush(ctx, hx + 1 * f, hy + 2.4, 1.5, 4);
        ctx.restore();
    }

    _leg(ctx, x1, x2, lift, col, f) {
        Art.limb(ctx, x1, -6, x2, -1.6 - lift, 3.4, col, { lineWidth: 1.2 });
        LateWorldArt.blob(ctx, x2 + 0.9 * f, -1.2 - lift, 2.8, 1.6, col, 1.1);
    }
}

// Triceratops (Welt 17): scharrt mit dem Fuß (Ankündigung) und stürmt dann los (G-18).
class Triceratops extends Enemy {
    constructor(x, y) {
        // höchstens 30 breit, sonst steckt er beim Erscheinen in Nachbarwänden (G-08)
        super(x, y, 30, 24);
        this.hp = 9;
        this.maxHp = 9;
        this.speed = 38;
        this.damage = 2;
        this.contactDamage = true;
        this.fxColor = '#5d8fff';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.face = 1;
        this.chargeTimer = 0;
        this.state = 'walk';     // walk → paw (Ankündigung) → charge → rest oder bonk (gegen die Wand)
        this.stateT = 0;
        this.chargeA = 0;
        this.walkT = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.chargeTimer -= dt;
        if (this.state === 'paw') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'charge';
                this.stateT = 0.4;
            }
            return;
        }
        if (this.state === 'charge') {
            const v = this.speed + 150;
            const sx = Math.cos(this.chargeA) * v * dt, sy = Math.sin(this.chargeA) * v * dt;
            const ox = this.x, oy = this.y;
            this._moveWithCollision(sx, sy, world);
            this.stateT -= dt;
            const moved = Math.abs(this.x - ox) + Math.abs(this.y - oy);
            if (moved < (Math.abs(sx) + Math.abs(sy)) * 0.4) {
                this.state = 'bonk';
                this.stateT = 0.7;
                if (typeof FX !== 'undefined') {
                    FX.burst(mx + Math.cos(this.chargeA) * 16, my + Math.sin(this.chargeA) * 10, ['#ffffff', '#ffd23f'], 6, 90, 0.35, { kind: 'star' });
                }
            } else if (this.stateT <= 0) {
                this.state = 'rest';
                this.stateT = 0.3;
            }
            return;
        }
        if (this.state === 'rest' || this.state === 'bonk') {
            this.stateT -= dt;
            if (this.stateT <= 0) this.state = 'walk';
            return;
        }
        if (dx > 3) this.face = 1; else if (dx < -3) this.face = -1;
        if (dist < 240) {
            this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
            this.walkT += dt;
            if (this.chargeTimer <= 0 && dist < 160) {
                this.chargeTimer = 3.2;
                this.state = 'paw';
                this.stateT = 0.5;
                this.chargeA = Math.atan2(dy, dx);
                this.face = dx >= 0 ? 1 : -1;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const f = this.face;
        const lk = this.look;
        const st = this.state;
        const col = '#5d8fff';
        const dark = Art.dark(col, 0.2);
        const k = st === 'paw' ? 1 - this.stateT / 0.5 : 0;
        if (st === 'paw') LateWorldArt.chevrons(ctx, cx, cy, this.chargeA, k);
        if (st === 'charge') LateWorldArt.speedLines(ctx, cx, cy - 2, this.chargeA, 13, 5);
        const run = st === 'walk' ? Math.sin(this.walkT * 12) : (st === 'charge' ? Math.sin(t * 40) : 0);
        const lower = st === 'paw' ? Math.min(1, k * 2) : (st === 'charge' ? 1 : 0);
        ctx.translate(cx, by);
        if (st === 'bonk') ctx.rotate(Math.sin(t * 25) * 0.05);
        // hintere Beine
        this._leg(ctx, -6 * f, Math.max(0, run) * 1.8, dark);
        this._leg(ctx, 7 * f, Math.max(0, -run) * 1.8, dark);
        // Schwanz
        ctx.beginPath();
        ctx.moveTo(-11 * f, -14);
        ctx.quadraticCurveTo(-16 * f, -12, -19 * f, -8 + Math.sin(t * 5 + this.seed));
        ctx.quadraticCurveTo(-15 * f, -8, -10 * f, -7.5);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = Art.ink(col);
        ctx.lineWidth = 1.4;
        ctx.lineJoin = 'round';
        ctx.stroke();
        // Körper mit Flecken
        Art.body(ctx, -1.5 * f, -11.5, 12.5, 8.2, col);
        ctx.fillStyle = Art.dark(col, 0.14);
        ctx.beginPath();
        ctx.moveTo(-6 * f + 1.8, -15);
        ctx.arc(-6 * f, -15, 1.8, 0, TAU);
        ctx.moveTo(-1 * f + 1.5, -17);
        ctx.arc(-1 * f, -17, 1.5, 0, TAU);
        ctx.moveTo(-9.5 * f + 1.4, -11);
        ctx.arc(-9.5 * f, -11, 1.4, 0, TAU);
        ctx.fill();
        // vordere Beine (scharrt vor dem Ansturm)
        const paw = st === 'paw' ? Math.abs(Math.sin(t * 22)) * 2.6 : 0;
        this._leg(ctx, -3.5 * f, Math.max(0, -run) * 1.8, col);
        this._leg(ctx, 5 * f, Math.max(0, run) * 1.8 + paw, col);
        if (paw > 0) LateWorldArt.dust(ctx, 5 * f, -1, 3.5, (t * 3) % 1);
        // Kopf senkt sich vor dem Ansturm
        ctx.save();
        ctx.translate(6 * f, -13);
        ctx.rotate(0.28 * f * lower);
        ctx.translate(-6 * f, 13);
        // Nackenschild: gezackter Fächer hinter dem Kopf
        Art.shape(ctx, c => {
            const F = Triceratops.FRILL;
            c.moveTo(F[0] * f, F[1]);
            for (let i = 2; i < F.length; i += 4) c.quadraticCurveTo(F[i] * f, F[i + 1], F[i + 2] * f, F[i + 3]);
            c.lineTo(9 * f, -10);
            c.closePath();
        }, { x: f > 0 ? -6 : -14, y: -27, w: 20, h: 17 }, '#ff8a3d', { lineWidth: 1.4 });
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(1.2 * f + 1.2, -18.5);
        ctx.arc(1.2 * f, -18.5, 1.2, 0, TAU);
        ctx.moveTo(5 * f + 1.2, -22.3);
        ctx.arc(5 * f, -22.3, 1.2, 0, TAU);
        ctx.moveTo(9.6 * f + 1.1, -21.8);
        ctx.arc(9.6 * f, -21.8, 1.1, 0, TAU);
        ctx.fill();
        // Kopf
        Art.body(ctx, 11 * f, -12.5, 6.4, 5.2, col);
        // Hörner: zwei lange über den Augen, ein kurzes auf der Nase
        ctx.beginPath();
        ctx.moveTo(8.6 * f, -15.8);
        ctx.quadraticCurveTo(13 * f, -19.5, 19.5 * f, -22);
        ctx.quadraticCurveTo(14.5 * f, -16, 12.4 * f, -13.9);
        ctx.closePath();
        ctx.moveTo(14.6 * f, -14.6);
        ctx.quadraticCurveTo(17 * f, -16.2, 19 * f, -17.6);
        ctx.quadraticCurveTo(18.2 * f, -14.6, 16.9 * f, -12.4);
        ctx.closePath();
        ctx.fillStyle = '#fff1cf';
        ctx.fill();
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 1.1;
        ctx.lineJoin = 'round';
        ctx.stroke();
        if (lower > 0.5) Art.glow(ctx, 19.5 * f, -22, 6, '#ffffff', 0.35 + 0.35 * Math.abs(Math.sin(t * 12)));
        // Schnabel
        ctx.beginPath();
        ctx.moveTo(15.5 * f, -12.2);
        ctx.quadraticCurveTo(19.5 * f, -11.5, 17.6 * f, -8.6);
        ctx.lineTo(14.6 * f, -9.4);
        ctx.closePath();
        ctx.fillStyle = '#3d57b8';
        ctx.fill();
        // Auge
        if (this.dead) LateWorldArt.xEyes(ctx, 10.4 * f, -13.8, 1.6, 0);
        else Art.eye(ctx, 10.4 * f + lk.x * 0.3, -13.8, 2.2, lk, { angry: st !== 'walk', side: f > 0 ? 'left' : 'right' });
        ctx.restore();
        if (st === 'bonk') LateWorldArt.dizzy(ctx, 8 * f, -27, 8, 2.4);
        ctx.restore();
    }

    _leg(ctx, x, lift, col) {
        Art.box(ctx, x - 2.4, -8 - lift, 4.8, 7.4, 2, col, { lineWidth: 1.2, highlight: false });
        ctx.fillStyle = '#fff1cf';
        ctx.fillRect(x - 2, -1.8 - lift, 4, 1.1);
    }
}
// Nackenschild: Startpunkt, dann je Kontrollpunkt und Punkt (Wellenrand), Blickrichtung rechts
Triceratops.FRILL = [-2.9, -11.8, -6, -15, -2.9, -18.3, -3.2, -22.7, 1.3, -23.2, 3.9, -26.8, 7.7, -24.4, 12, -25.4, 13.3, -21.1];

// Stachel-T-Rex (Welt 17): Brüllen mit sichtbarer Schallwelle; Schwanzhieb nur hinter dem Rücken,
// vorher leuchtet ein Warnkreis an der Schwanzspitze (G-13). Phase 2: Stacheln glühen.
class BossStingRex extends Enemy {
    constructor(x, y) {
        super(x, y, 120, 96);
        this.hp = 90;
        this.maxHp = 90;
        this.speed = 24;
        this.damage = 3;
        this.isBoss = true;
        this.contactDamage = false;
        this.fxColor = '#f0603a';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.face = 1;
        this.turnCd = 0;
        this.state = 'intro';    // intro → chase → roar/roarOut oder tailUp/tailSwipe
        this.introTimer = 2;
        this.stateT = 0;
        this.roarTimer = 4;
        this.tailTimer = 3;
        this.tailHit = false;
        this.phase = 1;
        this.walkT = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 45 && this.phase === 1) {
            this.phase = 2;
            this.speed = 32;
            this.tailTimer = Math.min(this.tailTimer, 2.2);
        }
        const R = BossStingRex;
        const mx = this.centerX(), my = this.centerY();
        const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
        const dx = pcx - mx, dy = pcy - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.turnCd = Math.max(0, this.turnCd - dt);
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'roar') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                // trifft nur innerhalb der vorher gezeigten Schallwelle
                if (dist < R.ROAR_R) {
                    player.applySlow(2.0, 0.55);
                    LateWorldArt.hurt(player, 1, Math.atan2(dy, dx), 120);
                }
                if (typeof FX !== 'undefined') {
                    FX.ring(mx, my, '#fff3c4', R.ROAR_R, 0.45, 6);
                    FX.burst(mx + this.face * 50, my - 24, ['#fff3c4', '#ffd88a'], 10, 150, 0.5, { kind: 'smoke', size: 5 });
                }
                LateWorldArt.shake(5, 0.3);
                this.state = 'roarOut';
                this.stateT = 0.35;
            }
            return;
        }
        if (this.state === 'roarOut') {
            this.stateT -= dt;
            if (this.stateT <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'tailUp') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'tailSwipe';
                this.stateT = 0.35;
                this.tailHit = false;
                LateWorldArt.shake(4, 0.15);
            }
            return;
        }
        if (this.state === 'tailSwipe') {
            this.stateT -= dt;
            // Trefferzone nur an der Schwanzspitze hinter dem Rücken
            const tx = mx - this.face * R.TAIL_X, ty = my + R.TAIL_Y;
            if (!this.tailHit && Math.hypot(pcx - tx, pcy - ty) < R.TAIL_R) {
                this.tailHit = true;
                LateWorldArt.hurt(player, 3, Math.atan2(pcy - ty, pcx - tx), 400);
                player.applySlow(1.2, 0.65);
            }
            if (this.stateT <= 0) this.state = 'chase';
            return;
        }
        // Verfolgen; dreht sich nur langsam um, so kann man hinter ihn laufen
        if (this.turnCd <= 0 && dx * this.face < -24) {
            this.face = -this.face;
            this.turnCd = 0.9;
        }
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.walkT += dt;
        this.roarTimer -= dt;
        this.tailTimer -= dt;
        const tx = mx - this.face * R.TAIL_X, ty = my + R.TAIL_Y;
        const behind = dx * this.face < 0 && Math.hypot(pcx - tx, pcy - ty) < 90;
        if (this.roarTimer <= 0) {
            // gleicher Takt wie bisher, Ausholen und Nachhall gehören dazu
            this.roarTimer = (this.phase === 1 ? 4.5 : 3.2) - 1.15;
            this.state = 'roar';
            this.stateT = 0.8;
        } else if (this.tailTimer <= 0 || (behind && this.tailTimer < 1.5)) {
            this.tailTimer = this.phase === 1 ? 3.5 : 2.5;
            this.state = 'tailUp';
            this.stateT = 0.45;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        const R = BossStingRex;
        const f = this.face;
        const lk = this.look;
        const st = this.state;
        const p2 = this.phase === 2;
        const col = '#f0603a';
        const ink = Art.ink(col);
        const spikeCol = p2 ? '#ffd23f' : '#fff0c2';
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, cy);
        // Vorwarnungen
        if (st === 'roar') LateWorldArt.warn(ctx, cx, cy, R.ROAR_R, 1 - this.stateT / 0.8, '#ffb020');
        const tailWarn = st === 'tailUp' || st === 'tailSwipe';
        if (tailWarn) {
            const k = st === 'tailUp' ? 1 - this.stateT / 0.45 : 1;
            LateWorldArt.warn(ctx, cx - f * R.TAIL_X, cy + R.TAIL_Y, R.TAIL_R, k, '#ff3d5a');
        }
        // Haltung
        const walk = st === 'chase' ? this.walkT : 0;
        const step = Math.sin(walk * 5);
        const bob = -Math.abs(step) * 2;
        let headA = 0, jaw = 0.06, arm = Math.sin(t * 4) * 0.5;
        let tailA = Math.sin(t * 2 + this.seed) * 0.06;
        if (st === 'roar') {
            const k = 1 - this.stateT / 0.8;
            headA = -0.22 * k;
            jaw = 0.1 + 0.3 * k;
            arm = Math.sin(t * 30) * 2;
        }
        if (st === 'roarOut') { headA = -0.12; jaw = 0.6; arm = Math.sin(t * 30) * 2; }
        if (st === 'intro') jaw = 0.1 + Math.max(0, Math.sin(t * 2.5)) * 0.3;
        if (st === 'tailUp') tailA = 0.6 * (1 - this.stateT / 0.45);
        if (st === 'tailSwipe') tailA = 0.6 - 1.05 * Math.sin((1 - this.stateT / 0.35) * Math.PI / 2);
        if (this.dead) jaw = 0.35;
        ctx.translate(cx, by);
        // hinteres Bein
        this._leg(ctx, -14, Math.max(0, step) * 5, Art.dark(col, 0.22), f);
        // Schwanz (dreht um die Hüfte)
        ctx.save();
        ctx.translate(-28 * f, -50 + bob);
        ctx.rotate(tailA * f);
        this._tail(ctx, f, col, spikeCol, p2 || tailWarn);
        ctx.restore();
        // Rückenstacheln
        this._spikes(ctx, R.BODY_SPIKES, f, bob, spikeCol, p2);
        // Körper
        Art.body(ctx, -6 * f, -50 + bob, 38, 28, col, { rot: -0.1 * f, lineWidth: 2.4 });
        ctx.fillStyle = '#ffe0a3';
        ctx.beginPath();
        ctx.ellipse(8 * f, -41 + bob, 21, 14, 0.15 * f, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#b8322a';
        ctx.lineWidth = 3.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const x = (-28 + i * 13) * f;
            ctx.moveTo(x, -72 + bob + i);
            ctx.quadraticCurveTo(x + 3 * f, -65 + bob, x - 1 * f, -59 + bob);
        }
        ctx.stroke();
        // vorderes Bein und Ärmchen
        this._leg(ctx, 6, Math.max(0, -step) * 5, col, f);
        // winziges Ärmchen mit Krallen (unter dem Kiefer)
        const hx = 38 * f, hy = -40 + bob + arm;
        Art.limb(ctx, 22 * f, -43 + bob, 31 * f, -36 + bob, 5.5, col, { lineWidth: 1.8 });
        Art.limb(ctx, 31 * f, -36 + bob, hx, hy, 4.5, col, { lineWidth: 1.8 });
        ctx.strokeStyle = '#fff0c2';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + 3.5 * f, hy - 1.5);
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + 3.5 * f, hy + 1.8);
        ctx.stroke();
        // Kopf (hebt sich zum Brüllen)
        ctx.save();
        ctx.translate(22 * f, -66 + bob);
        ctx.rotate(headA * f);
        this._head(ctx, f, col, ink, jaw, lk, p2, spikeCol, t);
        ctx.restore();
        // Schallwellen nach dem Brüllen
        if (st === 'roarOut') {
            const k = 1 - this.stateT / 0.35;
            const prevA = ctx.globalAlpha;
            ctx.globalAlpha = prevA * (1 - k);
            ctx.strokeStyle = '#fff3c4';
            ctx.lineWidth = 3;
            ctx.beginPath();
            const a0 = f > 0 ? -1.1 : Math.PI - 0.7;
            for (let i = 0; i < 3; i++) {
                const r = 14 + i * 12 + k * 30;
                ctx.moveTo(70 * f + Math.cos(a0) * r, -84 + bob + Math.sin(a0) * r);
                ctx.arc(70 * f, -84 + bob, r, a0, a0 + 1.8);
            }
            ctx.stroke();
            ctx.globalAlpha = prevA;
        }
        ctx.restore();
    }

    _leg(ctx, x, lift, col, f) {
        Art.body(ctx, x * f, -30 - lift * 0.5, 14, 17, col, { lineWidth: 2.2 });
        Art.body(ctx, (x + 7) * f, -6 - lift, 14, 6.5, col, { lineWidth: 2.2 });
        ctx.fillStyle = '#fff0c2';
        ctx.beginPath();
        for (let i = 0; i < 2; i++) {
            const px = (x + 18 + i * 3.5) * f, py = -5 - lift + i * 1.5;
            ctx.moveTo(px, py - 2);
            ctx.lineTo(px + 3.5 * f, py);
            ctx.lineTo(px, py + 2);
            ctx.closePath();
        }
        ctx.fill();
    }

    // Stacheln als ein Pfad: je Basis (x, y) und Spitze (x, y); glühen in Phase 2
    // (ein gemeinsames Leuchten je Stachelreihe – einzelne Glows wären zu teuer)
    _spikes(ctx, S, f, yy, color, glow) {
        if (glow) {
            const n = S.length / 4;
            const a = S[2], b = S[S.length - 2];
            let my = 0;
            for (let i = 3; i < S.length; i += 4) my += S[i];
            Art.glow(ctx, (a + b) / 2 * f, my / n + yy, Math.abs(b - a) / 2 + 14, '#ff9f1c', 0.6);
        }
        ctx.beginPath();
        for (let i = 0; i < S.length; i += 4) {
            ctx.moveTo((S[i] - 5) * f, S[i + 1] + yy + 1);
            ctx.lineTo(S[i + 2] * f, S[i + 3] + yy);
            ctx.lineTo((S[i] + 5) * f, S[i + 1] + yy);
            ctx.closePath();
        }
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#8a4a1c';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    _tail(ctx, f, col, spikeCol, glow) {
        this._spikes(ctx, BossStingRex.TAIL_SPIKES, f, 0, spikeCol, glow);
        Art.shape(ctx, c => {
            c.moveTo(6 * f, -14);
            c.quadraticCurveTo(-26 * f, -10, -56 * f, 14);
            c.quadraticCurveTo(-24 * f, 7, 6 * f, 13);
            c.closePath();
        }, { x: f > 0 ? -56 : -6, y: -14, w: 62, h: 28 }, col, { lineWidth: 2.2 });
        ctx.strokeStyle = '#b8322a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-18 * f, -7);
        ctx.lineTo(-20 * f, 2);
        ctx.moveTo(-34 * f, -1);
        ctx.lineTo(-35 * f, 6);
        ctx.stroke();
    }

    _head(ctx, f, col, ink, jaw, lk, p2, spikeCol, t) {
        this._spikes(ctx, BossStingRex.HEAD_SPIKES, f, 0, spikeCol, p2);
        // Maul-Inneres zwischen Schädel und Unterkiefer
        const tipx = (4 + Math.cos(jaw) * 38) * f, tipy = 7 + Math.sin(jaw) * 38;
        ctx.fillStyle = '#7a1f3d';
        ctx.beginPath();
        ctx.moveTo(4 * f, 3);
        ctx.lineTo(44 * f, 2);
        ctx.lineTo(tipx, tipy);
        ctx.closePath();
        ctx.fill();
        // Unterkiefer
        ctx.save();
        ctx.translate(4 * f, 7);
        ctx.rotate(jaw * f);
        Art.shape(ctx, c => {
            c.moveTo(0, 0);
            c.lineTo(38 * f, 0);
            c.quadraticCurveTo(44 * f, 4, 37 * f, 9);
            c.lineTo(4 * f, 10);
            c.quadraticCurveTo(-3 * f, 6, 0, 0);
            c.closePath();
        }, { x: f > 0 ? -3 : -44, y: 0, w: 47, h: 10 }, Art.dark(col, 0.1), { lineWidth: 2 });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const x = (12 + i * 7.5) * f;
            ctx.moveTo(x - 2 * f, 0.5);
            ctx.lineTo(x, -4);
            ctx.lineTo(x + 2 * f, 0.5);
            ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
        // Schädel
        Art.shape(ctx, c => {
            c.moveTo(-4 * f, -12);
            c.quadraticCurveTo(10 * f, -26, 30 * f, -22);
            c.quadraticCurveTo(46 * f, -19, 49 * f, -6);
            c.quadraticCurveTo(50 * f, 4, 43 * f, 6);
            c.lineTo(4 * f, 8);
            c.quadraticCurveTo(-8 * f, 2, -4 * f, -12);
            c.closePath();
        }, { x: f > 0 ? -8 : -50, y: -26, w: 58, h: 34 }, col, { lineWidth: 2.4 });
        // obere Zähne
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const x = (12 + i * 7) * f;
            const y = 7.4 - i * 0.35;
            ctx.moveTo(x - 2.2 * f, y);
            ctx.lineTo(x, y + 4.4);
            ctx.lineTo(x + 2.2 * f, y);
            ctx.closePath();
        }
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Nasenloch, Dampf in Phase 2
        ctx.fillStyle = Art.dark(col, 0.5);
        ctx.beginPath();
        ctx.ellipse(42 * f, -10, 2.4, 1.5, 0.3 * f, 0, TAU);
        ctx.fill();
        if (p2 && !this.dead) {
            const prevA = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 2; i++) {
                const k = (t * 1.3 + i * 0.5) % 1;
                ctx.globalAlpha = prevA * (1 - k) * 0.55;
                ctx.beginPath();
                ctx.arc((46 + k * 10) * f, -14 - k * 12, 2 + k * 4, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prevA;
        }
        // Auge
        if (this.dead) LateWorldArt.xEyes(ctx, 22 * f, -12, 4.5, 0);
        else Art.eye(ctx, 21 * f, -11.5, 7.6, lk, { angry: true, iris: p2 ? '#ff2d55' : '#ffd23f', side: f > 0 ? 'left' : 'right' });
    }
}
BossStingRex.ROAR_R = 150;     // Reichweite des Brüllens (vorher 220 und ohne Warnung)
BossStingRex.TAIL_X = 82;      // Schwanzspitze: so weit hinter der Mitte …
BossStingRex.TAIL_Y = 10;      // … und so weit darunter
BossStingRex.TAIL_R = 50;      // Trefferradius um die Schwanzspitze
// Stacheln (Basis x, y, Spitze x, y) für Blickrichtung rechts
BossStingRex.BODY_SPIKES = [-34, -68, -41, -79, -20, -74, -25, -87, -5, -77, -8, -91, 10, -76, 9, -89];
BossStingRex.HEAD_SPIKES = [4, -17, 1, -27, 15, -22, 13, -32];
BossStingRex.TAIL_SPIKES = [-9.9, -10.8, -14, -19, -25.5, -5, -30, -12.5, -40.9, 3.2, -45.5, -3];

// Lebende Uhr (Welt 18): läutet mit den Glocken, bevor sie eine bremsende Zeitblase schießt.
class TimeClock extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 24, 24);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 52;
        this.contactDamage = true;
        this.detectionRange = 240;
        this.beamTimer = 0.9;
        this.spin = Math.random() * Math.PI * 2;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
        this.fxColor = '#ffb627';
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.windup = 0;
        this.walkT = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.spin += dt * 4;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.windup = 0;
        if (dist < this.detectionRange) {
            this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
            this.walkT += dt;
            this.beamTimer -= dt;
            if (this.beamTimer < 0.4) this.windup = clamp(1 - this.beamTimer / 0.4, 0, 1);
            if (this.beamTimer <= 0) {
                this.beamTimer = 2.2;
                const p = LateWorldArt.shoot(mx, my, Math.atan2(dy, dx), 155, 50, LateWorldArt.shotTime);
                // bremst Mark: als Eis-Geschoss kennzeichnen (G-16)
                if (p) { p.slow = true; p.isIce = true; }
            }
        } else {
            this.beamTimer = Math.max(0.4, this.beamTimer);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const lk = this.look;
        const w = this.dead ? 0 : this.windup;
        // Beinchen mit Schuhen
        const step = Math.sin(this.walkT * 12) * 1.5;
        Art.limb(ctx, cx - 4, by - 7, cx - 5, by - 2.5 - Math.max(0, step), 1.6, '#3d2c6b', { lineWidth: 1 });
        Art.limb(ctx, cx + 4, by - 7, cx + 5, by - 2.5 - Math.max(0, -step), 1.6, '#3d2c6b', { lineWidth: 1 });
        LateWorldArt.blob(ctx, cx - 5.8, by - 2 - Math.max(0, step), 2.8, 1.8, '#ff5d8f', 1);
        LateWorldArt.blob(ctx, cx + 5.8, by - 2 - Math.max(0, -step), 2.8, 1.8, '#ff5d8f', 1);
        ctx.translate(cx + (w > 0 ? Math.sin(t * 70) * 0.8 * w : 0), cy - 0.5);
        // Glocken und Klöppel (läuten vor dem Schuss)
        const ring = w > 0 ? Math.sin(t * 60) * 0.3 * w : 0;
        Art.limb(ctx, -3, -9, -6.2, -11.6, 1.3, '#c98a1a', { lineWidth: 0.9 });
        Art.limb(ctx, 3, -9, 6.2, -11.6, 1.3, '#c98a1a', { lineWidth: 0.9 });
        Art.body(ctx, -7, -12.8, 4.3, 3.5, '#ffd23f', { rot: -0.5 + ring, lineWidth: 1.3 });
        Art.body(ctx, 7, -12.8, 4.3, 3.5, '#ffd23f', { rot: 0.5 - ring, lineWidth: 1.3 });
        const hx = w > 0 ? Math.sin(t * 60) * 4 : 0;
        Art.limb(ctx, 0, -10, hx, -14.5, 1.1, '#8a97c9', { lineWidth: 0.9 });
        LateWorldArt.blob(ctx, hx, -15.2, 1.6, 1.6, '#ffd23f', 1);
        if (w > 0) {
            // Klingel-Bögen
            const prevA = ctx.globalAlpha;
            ctx.globalAlpha = prevA * w;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(-7, -12.8, 7, Math.PI * 0.95, Math.PI * 1.35);
            ctx.moveTo(7 + 7 * Math.cos(-Math.PI * 0.35), -12.8 + 7 * Math.sin(-Math.PI * 0.35));
            ctx.arc(7, -12.8, 7, -Math.PI * 0.35, Math.PI * 0.05);
            ctx.stroke();
            ctx.globalAlpha = prevA;
        }
        // Gehäuse und Zifferblatt
        Art.body(ctx, 0, 0, 10.5, 10.5, '#ffb627', { lineWidth: 1.8 });
        ctx.fillStyle = w > 0 && Math.sin(t * 30) > 0 ? '#e0fbff' : '#fffaf0';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#c99a4a';
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
            ctx.lineTo(Math.cos(a) * 7.3, Math.sin(a) * 7.3);
        }
        ctx.stroke();
        // Zeiger drehen sich hinter den Augen
        const am = this.spin * 2.2, ah = this.spin * 0.35;
        ctx.strokeStyle = '#2b2f6b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0.5);
        ctx.lineTo(Math.cos(am) * 6, 0.5 + Math.sin(am) * 6);
        ctx.stroke();
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 0.5);
        ctx.lineTo(Math.cos(ah) * 4, 0.5 + Math.sin(ah) * 4);
        ctx.stroke();
        if (w > 0) Art.glow(ctx, 0, 0, 9 + w * 8, '#6fe7ff', 0.2 + 0.5 * w);
        if (this.dead) LateWorldArt.xEyes(ctx, 0, -2.2, 1.6, 3.1);
        else Art.eyes(ctx, lk.x * 1.2, -2.3, 2.2, { gap: 3.1, look: lk, angry: true, seed: this.seed });
        Art.mouth(ctx, lk.x, 4.6, 3.6, w > 0 ? 'open' : (this.dead ? 'o' : 'angry'));
        Art.shine(ctx, -4.4, -5, 2.6, 1.3, -0.6, 0.45);
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 11);
    }
}

// Riesen-Zeitkugel (Welt 18): Glaskugel mit Uhrwerk. Ring aus Zeit-Münzen (Strahlen warnen vor),
// rollt nach einer Warnbahn auf Mark zu und ist nach einem Aufprall an der Wand kurz benommen (G-21).
class BossTimeSphere extends Enemy {
    constructor(x, y) {
        super(x, y, 110, 110);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 24;
        this.isBoss = true;
        this.contactDamage = false;
        this.fxColor = '#6fe7ff';
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.state = 'intro';    // intro → chase → rollWind → roll → (dazed) → chase
        this.introTimer = 2;
        this.stateT = 0;
        this.burstTimer = 2.5;
        this.rollTimer = 4;
        this.phase = 1;
        this.spin = 0;
        this.rollA = 0;
        this.rollDir = { x: 1, y: 0 };
        this.rollSign = 1;
        this.rollHit = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 40) this.phase = 2;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        this.spin += dt * (this.phase === 1 ? 3 : 5);
        if (this.state === 'rollWind') {
            this.stateT -= dt;
            this.rollA += dt * 7 * this.rollSign;
            if (this.stateT <= 0) {
                this.state = 'roll';
                this.stateT = 0.9;
                this.rollHit = false;
            }
            return;
        }
        if (this.state === 'roll') {
            const sx = this.rollDir.x * 230 * dt, sy = this.rollDir.y * 230 * dt;
            const ox = this.x, oy = this.y;
            this._moveWithCollision(sx, sy, world);
            const moved = Math.hypot(this.x - ox, this.y - oy);
            this.rollA += (moved / 50) * this.rollSign;
            if (!this.rollHit && rectOverlap(this, player)) {
                this.rollHit = true;
                LateWorldArt.hurt(player, 2, Math.atan2(dy, dx), 250);
            }
            this.stateT -= dt;
            if (moved < Math.hypot(sx, sy) * 0.4) {
                // gegen die Wand gerollt: kurz benommen (Zeit zum Zurückschlagen)
                this.state = 'dazed';
                this.stateT = 1;
                LateWorldArt.shake(6, 0.25);
                if (typeof FX !== 'undefined') {
                    FX.burst(mx + this.rollDir.x * 50, my + this.rollDir.y * 50, ['#ffffff', '#6fe7ff', '#ffd23f'], 12, 160, 0.5, { kind: 'star' });
                }
            } else if (this.stateT <= 0) {
                this.state = 'chase';
            }
            if (this.state !== 'roll') this.rollTimer = this.phase === 1 ? 4 : 2.5;
            return;
        }
        if (this.state === 'dazed') {
            this.stateT -= dt;
            if (this.stateT <= 0) this.state = 'chase';
            return;
        }
        const ox = this.x;
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.rollA += (this.x - ox) / 50;
        this.burstTimer -= dt;
        if (this.burstTimer <= 0) {
            this.burstTimer = this.phase === 1 ? 2.5 : 1.6;
            const n = this.phase === 1 ? 8 : 14;
            for (let i = 0; i < n; i++) {
                const slow = this.phase === 2 && i % 3 === 0;
                const p = LateWorldArt.shoot(mx, my, (TAU * i) / n + this.spin, 160, 55, slow ? LateWorldArt.shotTime : LateWorldArt.shotChrono);
                if (p && slow) { p.slow = true; p.isIce = true; }
            }
            if (typeof FX !== 'undefined') FX.ring(mx, my, '#bff6ff', 80, 0.35, 4);
        }
        this.rollTimer -= dt;
        if (this.rollTimer <= 0 && this.burstTimer > 0.6) {
            this.state = 'rollWind';
            this.stateT = 0.7;
            this.rollDir.x = this.look.x;
            this.rollDir.y = this.look.y;
            this.rollSign = this.rollDir.x >= 0 ? 1 : -1;
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const lk = this.look;
        const st = this.state;
        const p2 = this.phase === 2;
        const R = 50;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, cy);
        // Vorwarnungen: Flugbahnen des Rings, Rollbahn
        const burstK = st === 'chase' && this.burstTimer < 0.5 ? 1 - this.burstTimer / 0.5 : 0;
        if (burstK > 0) LateWorldArt.rays(ctx, cx, cy, p2 ? 14 : 8, this.spin, R + 8, R + 62, burstK, '#ff3d5a');
        const rollAng = Math.atan2(this.rollDir.y, this.rollDir.x);
        if (st === 'rollWind') LateWorldArt.lane(ctx, cx, cy, rollAng, 165, 2 * R, 1 - this.stateT / 0.7, '#ff3d5a');
        if (st === 'roll') LateWorldArt.speedLines(ctx, cx, cy, rollAng, 34, 26);
        const hov = st === 'chase' || st === 'intro' ? Math.sin(t * 2 + this.seed) * 1.5 : 0;
        const jit = st === 'rollWind' ? Math.sin(t * 55) * 1.3 : 0;
        ctx.translate(cx + jit, cy + hov);
        this._ring(ctx, false, burstK, p2);
        // Kugel-Inneres mit Uhrwerk (dreht sich beim Rollen)
        Art.body(ctx, 0, 0, R, R, p2 ? '#3a2aa8' : '#2447b0', { outline: '#131a4f', lineWidth: 2.8, highlight: false });
        // Uhrwerk: alle Teile liegen innerhalb der Kugel (auch gedreht), daher ohne Clip
        ctx.save();
        ctx.rotate(this.rollA);
        this._gear(ctx, -20, 14, 21, 10, this.spin * 0.8, '#ffc53d');
        this._gear(ctx, 22, 18, 15, 8, -this.spin * 1.07, '#ffb020');
        this._gear(ctx, 8, -24, 12, 7, this.spin * 1.4, '#ffd76a');
        Art.glow(ctx, 0, 6, 36, p2 ? '#ff5d8f' : '#6fe7ff', 0.3 + 0.12 * Math.sin(t * 4) + burstK * 0.4);
        Art.body(ctx, 0, 10, 17, 17, '#f4fbff', { outline: '#1f3a8a', lineWidth: 2, highlight: false });
        ctx.strokeStyle = '#1f3a8a';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const a = (i * TAU) / 12;
            const r0 = i % 3 === 0 ? 11.5 : 13.5;
            ctx.moveTo(Math.cos(a) * r0, 10 + Math.sin(a) * r0);
            ctx.lineTo(Math.cos(a) * 15, 10 + Math.sin(a) * 15);
        }
        ctx.stroke();
        const hs = p2 ? 4 : 1;
        const am = this.spin * 1.6 * hs, ah = this.spin * 0.25 * hs;
        ctx.strokeStyle = '#131a4f';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(Math.cos(ah) * 8, 10 + Math.sin(ah) * 8);
        ctx.stroke();
        ctx.strokeStyle = '#ff4d6d';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(Math.cos(am) * 12.5, 10 + Math.sin(am) * 12.5);
        ctx.stroke();
        Art.body(ctx, 0, 10, 2.2, 2.2, '#ffd23f', { lineWidth: 1, highlight: false });
        ctx.restore();
        // Glas: Tönung, Glanz, in Phase 2 Risse
        const prevA = ctx.globalAlpha;
        ctx.globalAlpha = prevA * 0.14;
        ctx.fillStyle = '#bff6ff';
        ctx.beginPath();
        ctx.arc(0, 0, R - 2, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prevA;
        Art.ring(ctx, 0, 0, R - 4.5, '#9ff3ff', 1.6, 0.45);
        Art.shine(ctx, -21, -26, 15, 7.5, -0.75, 0.42);
        Art.shine(ctx, 27, 23, 4, 2.2, -0.75, 0.25);
        if (p2) {
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 1.4;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(30, -34);
            ctx.lineTo(24, -24);
            ctx.lineTo(29, -17);
            ctx.lineTo(22, -8);
            ctx.moveTo(24, -24);
            ctx.lineTo(16, -26);
            ctx.stroke();
        }
        // Augen auf dem Glas
        if (this.dead || st === 'dazed') LateWorldArt.xEyes(ctx, lk.x * 3, -22, 5.5, 14);
        else Art.eyes(ctx, lk.x * 4, -22, 8.5, { gap: 14, look: lk, angry: true, iris: p2 ? '#ff4d6d' : '#6fe7ff', seed: this.seed });
        // Aufzugskrone oben
        Art.box(ctx, -7, -R - 8, 14, 10, 3, '#ffc53d', { lineWidth: 1.8 });
        Art.body(ctx, 0, -R - 10, 8, 3.6, '#ffd23f', { lineWidth: 1.8 });
        this._ring(ctx, true, burstK, p2);
        if (st === 'dazed') LateWorldArt.dizzy(ctx, 0, -R - 18, 24, 5);
        ctx.restore();
    }
    // Zahnrad hinter dem Glas: flache Farbe mit Umriss und heller Kante oben links
    _gear(ctx, x, y, r, teeth, rot, color) {
        ctx.beginPath();
        LateWorldArt.gearPath(ctx, x, y, r, teeth, rot);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#7a4a00';
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.strokeStyle = Art.light(color, 0.45);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, Math.PI * 0.95, Math.PI * 1.55);
        ctx.stroke();
        ctx.fillStyle = '#7a4a00';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.28, 0, TAU);
        ctx.fill();
    }
    // Messingring mit zwölf Stunden-Lichtern (vordere oder hintere Hälfte)
    _ring(ctx, front, glowK, p2) {
        const rx = 62, ry = 13, y0 = 34;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.ellipse(0, y0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
        ctx.strokeStyle = '#6b4a00';
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.strokeStyle = '#ffc53d';
        ctx.lineWidth = 4;
        ctx.stroke();
        // Lichter: farbiger Hof, weißer Kern (vor dem Ring-Schuss ein gemeinsames Leuchten)
        const col = p2 ? '#ff5d8f' : '#6fe7ff';
        if (front && glowK > 0) Art.glow(ctx, 0, y0 + 4, rx + 10, col, glowK * 0.55);
        const hr = (front ? 3 : 2.2) + glowK * 1.5;
        for (let pass = 0; pass < 2; pass++) {
            ctx.fillStyle = pass === 0 ? col : '#ffffff';
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                const a = this.spin * 0.5 + (i * TAU) / 12;
                const s = Math.sin(a);
                if ((s >= 0) !== front) continue;
                const x = Math.cos(a) * rx, y = y0 + s * ry;
                const r = pass === 0 ? hr : hr * 0.45;
                ctx.moveTo(x + r, y);
                ctx.arc(x, y, r, 0, TAU);
            }
            ctx.fill();
        }
    }
}

// Schatten-Krokodil-Läufer (Welt 19): flinkes Krokodil mit Leuchtaugen; vor dem Wurf
// klappt das Maul auf und darin wächst die Schattenkugel.
class ShadowCrocodileRunner extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 28, 22);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 44;
        this.contactDamage = true;
        this.throwTimer = 0.9;
        this.spin = 0;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
        this.fxColor = '#7b5cff';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.face = 1;
        this.windup = 0;
        this.moving = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (dx > 3) this.face = 1; else if (dx < -3) this.face = -1;
        this.windup = 0;
        this.moving = false;
        if (dist < 240) {
            this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
            this.spin += dt * 6;
            this.moving = true;
            this.throwTimer -= dt;
            if (this.throwTimer < 0.35) this.windup = clamp(1 - this.throwTimer / 0.35, 0, 1);
            if (this.throwTimer <= 0) {
                this.throwTimer = 2.4;
                const p = LateWorldArt.shoot(mx, my, Math.atan2(dy, dx), 145, 55, LateWorldArt.shotShadow);
                if (p) p.bouncesLeft = 1;
            }
        } else {
            this.throwTimer = Math.max(0.35, this.throwTimer);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const f = this.face;
        const lk = this.look;
        const w = this.dead ? 0 : this.windup;
        const col = '#6a5cff';
        const ink = Art.ink(col);
        const dark = Art.dark(col, 0.2);
        const run = this.moving ? Math.sin(this.spin * 3) : 0;
        ctx.translate(cx, by);
        // Schwanz mit Zacken
        const wag = Math.sin(t * 8 + this.seed) * 1.6;
        ctx.beginPath();
        ctx.moveTo(-10 * f, -13.4);
        ctx.lineTo(-11.8 * f, -16.2);
        ctx.lineTo(-13 * f, -12.6);
        ctx.moveTo(-14.5 * f, -12.2);
        ctx.lineTo(-16.2 * f, -14.4 + wag * 0.5);
        ctx.lineTo(-17 * f, -11 + wag * 0.5);
        ctx.fillStyle = '#3b2d9e';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7 * f, -13.8);
        ctx.quadraticCurveTo(-15 * f, -13, -21 * f, -7.5 + wag);
        ctx.quadraticCurveTo(-14 * f, -5.4, -7 * f, -4.8);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.3;
        ctx.lineJoin = 'round';
        ctx.stroke();
        // hintere Beine (dunkler), dann Körper, dann vordere Beine
        this._leg(ctx, -6 * f, run, dark, f);
        this._leg(ctx, 4 * f, -run, dark, f);
        // Rückenzacken (hinter dem Körper)
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const x = (-7 + i * 3.6) * f, y = -13.2 - (i === 1 || i === 2 ? 0.8 : 0);
            ctx.moveTo(x - 1.8 * f, y + 1.4);
            ctx.lineTo(x - 0.6 * f, y - 2.8);
            ctx.lineTo(x + 1.8 * f, y + 1.4);
            ctx.closePath();
        }
        ctx.fillStyle = '#3b2d9e';
        ctx.fill();
        ctx.strokeStyle = '#1c1057';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        Art.body(ctx, -1 * f, -9, 10, 5.6, col);
        ctx.fillStyle = '#b9b0ff';
        ctx.beginPath();
        ctx.ellipse(0, -5.4, 7.5, 1.9, 0, 0, TAU);
        ctx.fill();
        this._leg(ctx, -3.5 * f, -run, col, f);
        this._leg(ctx, 6.5 * f, run, col, f);
        // Kopf: Unterkiefer klappt vor dem Wurf auf, im Maul wächst die Schattenkugel
        const ja = w * 0.6;
        if (ja > 0) {
            ctx.fillStyle = '#5a1030';
            ctx.beginPath();
            ctx.moveTo(6 * f, -9.2);
            ctx.lineTo(17 * f, -9.4);
            ctx.lineTo((6 + Math.cos(ja) * 11) * f, -9 + Math.sin(ja) * 11);
            ctx.closePath();
            ctx.fill();
        }
        ctx.save();
        ctx.translate(6 * f, -9);
        ctx.rotate(ja * f);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10.5 * f, -0.3);
        ctx.quadraticCurveTo(12.4 * f, 1.4, 10.2 * f, 3);
        ctx.lineTo(1 * f, 3.4);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
        if (w > 0) {
            const orb = 1.4 + w * 2;
            Art.glow(ctx, 12.5 * f, -8.4, 5 + w * 8, '#7dff9e', 0.45 + 0.5 * w);
            Art.body(ctx, 12.5 * f, -8.4, orb, orb, '#5b3fd6', { outline: '#1c1057', lineWidth: 1, highlight: false });
            Art.body(ctx, 12.5 * f, -8.4, orb * 0.5, orb * 0.5, '#d4ff7a', { outline: false, highlight: false, flat: true });
        }
        ctx.beginPath();
        ctx.moveTo(4.5 * f, -14.6);
        ctx.quadraticCurveTo(8.5 * f, -16.6, 11.5 * f, -13.4);
        ctx.lineTo(17 * f, -11.7);
        ctx.quadraticCurveTo(19.4 * f, -10.6, 17.3 * f, -9.3);
        ctx.lineTo(6 * f, -8.8);
        ctx.quadraticCurveTo(3 * f, -11, 4.5 * f, -14.6);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const x = (8 + i * 2.6) * f, yb = -9 - i * 0.1;
            ctx.moveTo(x - 0.9 * f, yb);
            ctx.lineTo(x, yb + 1.7);
            ctx.lineTo(x + 0.9 * f, yb);
        }
        ctx.fill();
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(16.8 * f, -11.6, 0.6, 0, TAU);
        ctx.fill();
        // Leuchtaugen auf Höckern
        LateWorldArt.blob(ctx, 6.6 * f, -14.8, 2.6, 2.2, col, 1.1);
        LateWorldArt.blob(ctx, 9.6 * f, -14.5, 2.3, 2, col, 1.1);
        if (this.dead) {
            LateWorldArt.xEyes(ctx, 8.1 * f, -15, 1.1, 1.5);
        } else {
            const bl = Math.max(0.2, Art.blink(this.seed));
            ctx.fillStyle = '#d4ff7a';
            ctx.beginPath();
            ctx.ellipse(6.6 * f + lk.x * 0.3, -15.1, 1.7, 1.3 * bl, 0, 0, TAU);
            ctx.moveTo(9.6 * f + lk.x * 0.3 + 1.5, -14.8);
            ctx.ellipse(9.6 * f + lk.x * 0.3, -14.8, 1.5, 1.2 * bl, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#1c1057';
            ctx.fillRect(6.6 * f + lk.x * 0.6 - 0.3, -15.9, 0.6, 1.6 * bl);
            ctx.fillRect(9.6 * f + lk.x * 0.6 - 0.3, -15.6, 0.6, 1.4 * bl);
            // böse Brauen
            ctx.strokeStyle = ink;
            ctx.lineWidth = 1.1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(5 * f, -17.6);
            ctx.lineTo(7.8 * f, -16.8);
            ctx.moveTo(8.6 * f, -16.9);
            ctx.lineTo(11 * f, -17.3);
            ctx.stroke();
        }
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 10);
    }
    // Kurzes Krokodil-Bein, das beim Laufen trippelt
    _leg(ctx, x, run, col, f) {
        const lift = Math.max(0, run) * 1.8;
        Art.limb(ctx, x, -7, x + run * 1.6 * f, -2 - lift, 2.8, col, { lineWidth: 1.1 });
        LateWorldArt.blob(ctx, x + (run * 1.6 + 1.1) * f, -1.5 - lift, 2.5, 1.4, col, 1);
    }
}

// Schatten-Krokodil (Welt 19): Todesrolle mit Warnkreis und sechs Schattenkugeln; Sprünge mit
// Kollision statt Teleport (G-03). Phase 2: rote Augen, stärkere Aura, glühende Zacken.
class BossShadowCrocodile extends Enemy {
    constructor(x, y) {
        super(x, y, 118, 86);
        this.hp = 85;
        this.maxHp = 85;
        this.speed = 28;
        this.isBoss = true;
        this.contactDamage = false;
        this.fxColor = '#7b5cff';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.face = 1;
        this.state = 'intro';    // intro → chase → whirlWind → whirl | leapWind → leap
        this.introTimer = 2;
        this.stateT = 0;
        this.whirlTimer = 3.5;
        this.leapTimer = 6;
        this.phase = 1;
        this.whirlT = 0;
        this.rollAng = 0;
        this.walkT = 0;
        this.leapSX = 0; this.leapSY = 0; this.leapTX = 0; this.leapTY = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 42) this.phase = 2;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'whirlWind') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'whirl';
                this.whirlT = 0;
                LateWorldArt.shootRing(mx, my, 6, 125, 50, 0, LateWorldArt.shotShadow);
                if (typeof FX !== 'undefined') FX.ring(mx, my, '#b9a8ff', 100, 0.4, 5);
            }
            return;
        }
        if (this.state === 'whirl') {
            this.whirlT += dt;
            this.rollAng += dt * 13 * this.face;
            if (dist < 100) LateWorldArt.hurt(player, 2, Math.atan2(dy, dx), 180);
            if (this.whirlT > 1.5) {
                this.state = 'chase';
                this.whirlT = 0;
                this.rollAng = 0;
            }
            return;
        }
        if (this.state === 'leapWind') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'leap';
                this.stateT = 0.45;
            }
            return;
        }
        if (this.state === 'leap') {
            this.stateT -= dt;
            const k = clamp(1 - this.stateT / 0.45, 0, 1);
            // Sprung über die Wand-Kollision – nie durch Wände (G-03)
            const tx = this.leapSX + (this.leapTX - this.leapSX) * k;
            const ty = this.leapSY + (this.leapTY - this.leapSY) * k;
            this._moveWithCollision(tx - this.x, ty - this.y, world);
            if (this.stateT <= 0) {
                this.state = 'chase';
                LateWorldArt.shake(5, 0.15);
                if (typeof FX !== 'undefined') {
                    FX.burst(this.centerX(), this.y + this.h - 4, ['#b9a8ff', '#7dff9e', '#ffffff'], 12, 150, 0.5, { kind: 'smoke', size: 5 });
                    FX.ring(this.centerX(), this.y + this.h - 6, '#b9a8ff', 80, 0.4, 5);
                }
            }
            return;
        }
        if (dx > 24) this.face = 1; else if (dx < -24) this.face = -1;
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.walkT += dt;
        this.whirlTimer -= dt;
        this.leapTimer -= dt;
        if (this.whirlTimer <= 0) {
            // gleicher Takt wie bisher, das Ausholen gehört dazu
            this.whirlTimer = (this.phase === 1 ? 3.5 : 2.4) - 0.55;
            this.state = 'whirlWind';
            this.stateT = 0.55;
        } else if (this.leapTimer <= 0) {
            this.leapTimer = (this.phase === 1 ? 6 : 4) - 0.95;
            this._planLeap(world);
        }
    }
    // Sprungziel 140 Richtung Mark; nur ein freier Platz zählt, sonst kürzer.
    // Ist gar nichts frei, bremst die Kollision den Sprung (G-03).
    _planLeap(world) {
        let tx = this.x + this.look.x * 140, ty = this.y + this.look.y * 140;
        for (let s = 1; s > 0.2; s -= 0.25) {
            const x = this.x + this.look.x * 140 * s, y = this.y + this.look.y * 140 * s;
            if (LateWorldArt.free(world, x, y, this.w, this.h)) { tx = x; ty = y; break; }
        }
        this.leapSX = this.x;
        this.leapSY = this.y;
        this.leapTX = tx;
        this.leapTY = ty;
        this.face = this.look.x >= 0 ? 1 : -1;
        this.state = 'leapWind';
        this.stateT = 0.5;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        const f = this.face;
        const lk = this.look;
        const st = this.state;
        const p2 = this.phase === 2;
        const col = p2 ? '#5b46e6' : '#6a5cff';
        const ink = Art.ink(col);
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, cy);
        // Vorwarnung Todesrolle: Warnkreis (Nahschaden) und Strahlen (Schattenkugeln)
        if (st === 'whirlWind') {
            const k = 1 - this.stateT / 0.55;
            LateWorldArt.warn(ctx, cx, cy, 100, k, '#ff3d5a');
            LateWorldArt.rays(ctx, cx, cy, 6, 0, 100, 150, k, '#ff3d5a');
        }
        if (st === 'whirl') LateWorldArt.warn(ctx, cx, cy, 100, 1, '#ff3d5a');
        Art.glow(ctx, cx, cy + 6, 66, p2 ? '#6a2dff' : '#5a3dff', p2 ? 0.38 : 0.24);
        // Pose
        const walk = st === 'chase' ? this.walkT : 0;
        const step = Math.sin(walk * 6);
        let lift = 0, sx = 1, sy = 1;
        let jaw = 0.08 + Math.max(0, Math.sin(t * 1.3 + this.seed)) * 0.08;
        if (st === 'whirlWind') {
            const k = 1 - this.stateT / 0.55;
            sx = 1 + 0.06 * k; sy = 1 - 0.06 * k; jaw = 0.3;
        }
        if (st === 'leapWind') {
            const k = 1 - this.stateT / 0.5;
            sx = 1 + 0.1 * k; sy = 1 - 0.1 * k;
        }
        if (st === 'leap') {
            const k = clamp(1 - this.stateT / 0.45, 0, 1);
            lift = Math.sin(k * Math.PI) * 30;
            sx = 0.94; sy = 1.08; jaw = 0.4;
        }
        if (st === 'intro') jaw = 0.1 + Math.max(0, Math.sin(t * 2)) * 0.35;
        if (this.dead) jaw = 0.45;
        ctx.translate(cx, by - lift);
        if (st === 'whirl') {
            // Todesrolle: dreht sich um die Körpermitte
            ctx.translate(0, -36);
            ctx.rotate(this.rollAng);
            ctx.translate(0, 36);
        }
        ctx.scale(sx, sy);
        const dark = Art.dark(col, 0.22);
        this._leg(ctx, -20, Math.max(0, step) * 4, dark, f);
        this._leg(ctx, 24, Math.max(0, -step) * 4, dark, f);
        this._tail(ctx, f, col, t);
        Art.body(ctx, -6 * f, -35, 45, 23, col, { lineWidth: 2.4 });
        ctx.fillStyle = '#b1a6ff';
        ctx.beginPath();
        ctx.ellipse(0, -19.5, 37, 6.5, 0, 0, TAU);
        ctx.fill();
        this._ridges(ctx, f, p2);
        this._marks(ctx, f, p2, t);
        this._leg(ctx, -28, Math.max(0, -step) * 4, col, f);
        this._leg(ctx, 16, Math.max(0, step) * 4, col, f);
        this._head(ctx, f, col, ink, jaw, lk, p2);
        if (st === 'whirl') {
            // Wirbel-Bögen
            const prevA = ctx.globalAlpha;
            ctx.globalAlpha = prevA * 0.7;
            ctx.strokeStyle = '#d6ccff';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const a = -this.rollAng * 1.3 + (i * TAU) / 3;
                ctx.moveTo(Math.cos(a) * 78, -36 + Math.sin(a) * 78);
                ctx.arc(0, -36, 78, a, a + 1);
            }
            ctx.stroke();
            ctx.globalAlpha = prevA;
        }
        ctx.restore();
    }
    _leg(ctx, x, lift, col, f) {
        Art.body(ctx, x * f, -14 - lift, 8.5, 9, col, { lineWidth: 2 });
        Art.body(ctx, (x + 4) * f, -4.5 - lift, 10, 4.6, col, { lineWidth: 2 });
        ctx.fillStyle = '#e9e4ff';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const px = (x + 10 + i * 2.2) * f, py = -2.4 - lift - i * 1.6;
            ctx.moveTo(px, py - 1.3);
            ctx.lineTo(px + 2.4 * f, py + 0.4);
            ctx.lineTo(px, py + 1.4);
            ctx.closePath();
        }
        ctx.fill();
    }
    _tail(ctx, f, col, t) {
        const wag = Math.sin(t * 3 + this.seed) * 4;
        // Zacken zuerst, der Schwanz verdeckt ihren Ansatz
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const s = 0.15 + i * 0.2;
            const x = ((1 - s) * (1 - s) * -36 + 2 * (1 - s) * s * -64 + s * s * -88) * f;
            const y = (1 - s) * (1 - s) * -48 + 2 * (1 - s) * s * -44 + s * s * (-30 + wag);
            ctx.moveTo(x + 4 * f, y + 2);
            ctx.lineTo(x - 1 * f, y - 7 + i);
            ctx.lineTo(x - 4 * f, y + 3);
            ctx.closePath();
        }
        ctx.fillStyle = '#3b2d9e';
        ctx.fill();
        ctx.strokeStyle = '#1c1057';
        ctx.lineWidth = 1.2;
        ctx.lineJoin = 'round';
        ctx.stroke();
        Art.shape(ctx, c => {
            c.moveTo(-34 * f, -49);
            c.quadraticCurveTo(-64 * f, -44, -88 * f, -30 + wag);
            c.quadraticCurveTo(-62 * f, -22, -32 * f, -19);
            c.closePath();
        }, { x: f > 0 ? -88 : 32, y: -49, w: 56, h: 30 }, col, { lineWidth: 2.2 });
    }
    _ridges(ctx, f, p2) {
        const R = BossShadowCrocodile.RIDGES;
        ctx.beginPath();
        for (let i = 0; i < R.length; i += 2) {
            const x = R[i] * f, y = R[i + 1];
            ctx.moveTo(x - 4.5, y + 3);
            ctx.lineTo(x - 1.5 * f, y - 6.5);
            ctx.lineTo(x + 4.5, y + 3);
            ctx.closePath();
        }
        ctx.fillStyle = p2 ? '#4a37c9' : '#3b2d9e';
        ctx.fill();
        ctx.strokeStyle = '#1c1057';
        ctx.lineWidth = 1.3;
        ctx.lineJoin = 'round';
        ctx.stroke();
        if (p2) {
            // Phase 2: glühende Zackenspitzen
            ctx.fillStyle = '#b6ff5a';
            ctx.beginPath();
            for (let i = 0; i < R.length; i += 2) {
                const x = R[i] * f, y = R[i + 1];
                ctx.moveTo(x - 2.4 * f, y - 2.6);
                ctx.lineTo(x - 1.5 * f, y - 6.5);
                ctx.lineTo(x + 0.4 * f, y - 2.8);
                ctx.closePath();
            }
            ctx.fill();
        }
    }
    // Leuchtende Flecken an der Seite
    _marks(ctx, f, p2, t) {
        const c = p2 ? '#ff7a9c' : (Math.sin(t * 3 + this.seed) > 0 ? '#9dffb4' : '#7dff9e');
        ctx.fillStyle = c;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const x = (-32 + i * 14) * f, y = -37 + (i % 2) * 4;
            ctx.moveTo(x + 2.6, y);
            ctx.ellipse(x, y, 2.6, 1.7, 0, 0, TAU);
        }
        ctx.fill();
    }
    _head(ctx, f, col, ink, jaw, lk, p2) {
        // Maul-Inneres
        const tipx = (26 + Math.cos(jaw) * 46) * f, tipy = -32 + Math.sin(jaw) * 46;
        ctx.fillStyle = '#5a1030';
        ctx.beginPath();
        ctx.moveTo(26 * f, -33);
        ctx.lineTo(74 * f, -35);
        ctx.lineTo(tipx, tipy);
        ctx.closePath();
        ctx.fill();
        // Unterkiefer
        ctx.save();
        ctx.translate(26 * f, -32);
        ctx.rotate(jaw * f);
        Art.shape(ctx, c => {
            c.moveTo(0, 0);
            c.lineTo(46 * f, -1);
            c.quadraticCurveTo(52 * f, 3, 46 * f, 8);
            c.lineTo(4 * f, 9);
            c.quadraticCurveTo(-4 * f, 5, 0, 0);
            c.closePath();
        }, { x: f > 0 ? -4 : -52, y: -1, w: 56, h: 10 }, Art.dark(col, 0.08), { lineWidth: 2 });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const x = (10 + i * 8) * f;
            ctx.moveTo(x - 2 * f, 0);
            ctx.lineTo(x, -4.5);
            ctx.lineTo(x + 2 * f, -0.2);
            ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
        // Oberkiefer und Kopf
        Art.shape(ctx, c => {
            c.moveTo(16 * f, -52);
            c.quadraticCurveTo(32 * f, -67, 50 * f, -53);
            c.lineTo(74 * f, -46);
            c.quadraticCurveTo(83 * f, -41, 76 * f, -33);
            c.lineTo(26 * f, -31);
            c.quadraticCurveTo(12 * f, -40, 16 * f, -52);
            c.closePath();
        }, { x: f > 0 ? 12 : -83, y: -66, w: 71, h: 35 }, col, { lineWidth: 2.4 });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const x = (32 + i * 7) * f;
            const y = -32.4 - i * 0.3;
            ctx.moveTo(x - 2 * f, y);
            ctx.lineTo(x, y + 4.8);
            ctx.lineTo(x + 2 * f, y);
            ctx.closePath();
        }
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        // Nasenhöcker
        Art.body(ctx, 72 * f, -45.5, 5.4, 3.6, col, { lineWidth: 1.6, highlight: false });
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(70.5 * f, -46.3, 0.9, 0, TAU);
        ctx.moveTo(74 * f + 0.9, -45.8);
        ctx.arc(74 * f, -45.8, 0.9, 0, TAU);
        ctx.fill();
        // Leuchtaugen auf Höckern
        Art.body(ctx, 33 * f, -58.5, 8, 7, col, { lineWidth: 2 });
        Art.body(ctx, 46 * f, -57, 7.2, 6.4, col, { lineWidth: 2 });
        if (this.dead) {
            LateWorldArt.xEyes(ctx, 39.5 * f, -58.5, 3.4, 6.5);
            return;
        }
        const eyeCol = p2 ? '#ff4d6d' : '#b6ff5a';
        Art.glow(ctx, 39.5 * f, -58.5, 24, eyeCol, 0.5);
        const bl = Math.max(0.2, Art.blink(this.seed));
        ctx.fillStyle = p2 ? '#ff8aa0' : '#d4ff7a';
        ctx.beginPath();
        ctx.ellipse(33 * f + lk.x * 0.8, -59, 5, 4 * bl, 0, 0, TAU);
        ctx.moveTo(46 * f + lk.x * 0.8 + 4.6, -57.6);
        ctx.ellipse(46 * f + lk.x * 0.8, -57.6, 4.6, 3.7 * bl, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#1c1057';
        ctx.fillRect(33 * f + lk.x * 1.6 - 0.9, -61.5, 1.8, 5 * bl);
        ctx.fillRect(46 * f + lk.x * 1.6 - 0.9, -60, 1.8, 4.6 * bl);
        // böse Brauen
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(26 * f, -66);
        ctx.lineTo(37 * f, -63);
        ctx.moveTo(42 * f, -62.6);
        ctx.lineTo(53 * f, -64.2);
        ctx.stroke();
    }
}
// Rückenzacken (x, y) für Blickrichtung rechts
BossShadowCrocodile.RIDGES = [-36, -51.5, -24, -55.5, -12, -57, 0, -57, 12, -55.5, 24, -51.5];

// Fußball-Gegner (Welt 20): rollt heran; kommt Mark nah, holt er sichtbar aus und sprintet kurz.
// Die unsichtbare 90er-Schadenszone und das Dauer-Wackeln sind weg (G-12).
class FootballEnemy extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 22, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 60;
        this.rollT = 0;
        this.contactDamage = true;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
        this.fxColor = '#ffb020';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.state = 'chase';    // chase → windup (Ankündigung) → dash
        this.stateT = 0;
        this.dashCd = 0.8;
        this.dashDir = { x: 1, y: 0 };
        this.rollA = 0;
        this.bounceT = Math.random() * 3;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.dashCd = Math.max(0, this.dashCd - dt);
        if (this.state === 'windup') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'dash';
                this.stateT = 0.3;
            }
            return;
        }
        if (this.state === 'dash') {
            const sx = this.dashDir.x * 200 * dt, sy = this.dashDir.y * 200 * dt;
            const ox = this.x, oy = this.y;
            this._moveWithCollision(sx, sy, world);
            const moved = Math.hypot(this.x - ox, this.y - oy);
            this.rollA += (moved / 10) * (this.dashDir.x >= 0 ? 1 : -1);
            this.stateT -= dt;
            if (this.stateT <= 0 || moved < Math.hypot(sx, sy) * 0.4) {
                this.state = 'chase';
                this.dashCd = 1.6;
            }
            return;
        }
        if (dist < 250) {
            this.rollT += dt * 9;
            this.bounceT += dt;
            const ox = this.x, oy = this.y;
            this._moveWithCollision(this.look.x * this.speed * dt + Math.sin(this.rollT) * 10 * dt, this.look.y * this.speed * dt, world);
            const moved = Math.hypot(this.x - ox, this.y - oy);
            this.rollA += (moved / 10) * (this.x >= ox ? 1 : -1);
            if (dist < 90 && this.dashCd <= 0) {
                this.state = 'windup';
                this.stateT = 0.35;
                this.dashDir.x = this.look.x;
                this.dashDir.y = this.look.y;
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const lk = this.look;
        const st = this.state;
        const k = st === 'windup' ? 1 - this.stateT / 0.35 : 0;
        const dashA = Math.atan2(this.dashDir.y, this.dashDir.x);
        if (st === 'windup') LateWorldArt.chevrons(ctx, cx, cy, dashA, k);
        if (st === 'dash') LateWorldArt.speedLines(ctx, cx, cy - 2, dashA, 12, 5);
        const b = Math.abs(Math.sin(this.bounceT * 9));
        const bounce = st === 'chase' ? b * 3 : 0;
        let sx = 1, sy = 1;
        if (st === 'windup') { const s = Math.min(1, k * 2); sx = 1 + 0.13 * s; sy = 1 - 0.13 * s; }
        else if (st === 'chase' && b < 0.2) { sx = 1.06; sy = 0.94; }
        else if (st === 'dash') { sx = 1.08; sy = 0.93; }
        // Fußballschuhe
        const step = Math.sin(this.bounceT * 9);
        LateWorldArt.blob(ctx, cx - 5, by - 2 - Math.max(0, step) * 1.5, 3.8, 2.2, '#ff9f1c', 1.1);
        LateWorldArt.blob(ctx, cx + 5, by - 2 - Math.max(0, -step) * 1.5, 3.8, 2.2, '#ff9f1c', 1.1);
        ctx.translate(cx, by - 3 - bounce);
        ctx.scale(sx, sy);
        const yb = -10;
        Art.body(ctx, 0, yb, 10, 10, '#ffffff', { outline: '#26325c', lineWidth: 1.6, highlight: false });
        ctx.save();
        ctx.clip();
        ctx.save();
        ctx.translate(0, yb);
        ctx.rotate(this.rollA);
        ctx.strokeStyle = '#aab3d4';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i * TAU) / 5;
            ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
            ctx.lineTo(Math.cos(a) * 6.4, Math.sin(a) * 6.4);
        }
        ctx.stroke();
        ctx.fillStyle = '#26325c';
        ctx.beginPath();
        LateWorldArt.poly(ctx, 0, 0, 3, 5, -Math.PI / 2);
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i * TAU) / 5 + TAU / 10;
            LateWorldArt.poly(ctx, Math.cos(a) * 9.2, Math.sin(a) * 9.2, 2.9, 5, a);
        }
        ctx.fill();
        ctx.restore();
        // rotes Schweißband
        ctx.fillStyle = '#ff4d5e';
        ctx.beginPath();
        ctx.moveTo(-11, yb - 7.4);
        ctx.quadraticCurveTo(0, yb - 11, 11, yb - 7.4);
        ctx.lineTo(11, yb - 4.4);
        ctx.quadraticCurveTo(0, yb - 7.9, -11, yb - 4.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(-11, yb - 5.9);
        ctx.quadraticCurveTo(0, yb - 9.4, 11, yb - 5.9);
        ctx.stroke();
        ctx.restore();
        Art.shine(ctx, -5.4, yb - 1.2, 2.2, 1.4, -0.6, 0.5);
        if (this.dead) LateWorldArt.xEyes(ctx, lk.x * 1.2, yb - 1.2, 1.8, 3.7);
        else Art.eyes(ctx, lk.x * 1.4, yb - 1.3, 2.6, { gap: 3.7, look: lk, angry: true, seed: this.seed });
        Art.mouth(ctx, lk.x * 1.2, yb + 4.2, 4.4, st === 'chase' ? (this.dead ? 'o' : 'angry') : 'grin');
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 9);
    }
}

// Riesen-Fußball (Welt 20): pumpt sich sichtbar auf (Strahlen zeigen die Flugbahnen) und platzt
// in einen Ring aus Mini-Bällen. Hüpfer statt Teleport-Ruckler (G-03), eigene Spielzeit (G-22).
class BossFootball extends Enemy {
    constructor(x, y) {
        super(x, y, 128, 92);
        this.hp = 90;
        this.maxHp = 90;
        this.speed = 20;
        this.isBoss = true;
        this.contactDamage = false;
        this.fxColor = '#ffb020';
        this.shadow = { rx: 48, ry: 13 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.state = 'intro';    // intro → chase → inflate → deflate | hop
        this.introTimer = 2;
        this.stateT = 0;
        this.popTimer = 2.8;
        this.rollTimer = 1.4;
        this.inflate = 1;
        this.phase = 1;
        this.t = 0;
        this.rollA = 0;
        this.hopSX = 0; this.hopSY = 0; this.hopTX = 0; this.hopTY = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.hp <= 45) this.phase = 2;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'inflate') {
            this.stateT -= dt;
            const k = clamp(1 - this.stateT / 0.55, 0, 1);
            this.inflate = 1 + 0.3 * (1 - (1 - k) * (1 - k));
            if (this.stateT <= 0) {
                LateWorldArt.shootRing(mx, my, this.phase === 1 ? 6 : 10, 150, 50, 0, LateWorldArt.shotBall);
                if (typeof FX !== 'undefined') {
                    FX.burst(mx, my, ['#ffffff', '#ffb020', '#ff4d5e'], 14, 190, 0.5);
                    FX.ring(mx, my, '#ffffff', 90, 0.35, 5);
                }
                LateWorldArt.shake(4, 0.15);
                this.state = 'deflate';
                this.stateT = 0.3;
            }
            return;
        }
        if (this.state === 'deflate') {
            this.stateT -= dt;
            this.inflate = 1 + 0.3 * Math.max(0, this.stateT / 0.3);
            if (this.stateT <= 0) {
                this.inflate = 1;
                this.state = 'chase';
                // gleicher Takt wie bisher, Aufpumpen und Luftablassen gehören dazu
                this.popTimer = (this.phase === 1 ? 2.8 : 1.9) - 0.85;
            }
            return;
        }
        if (this.state === 'hop') {
            this.stateT -= dt;
            const k = clamp(1 - this.stateT / 0.28, 0, 1);
            // Hüpfer über die Wand-Kollision statt Versetzen (G-03)
            this._moveWithCollision(this.hopSX + (this.hopTX - this.hopSX) * k - this.x,
                this.hopSY + (this.hopTY - this.hopSY) * k - this.y, world);
            if (this.stateT <= 0) {
                this.state = 'chase';
                LateWorldArt.shake(2.5, 0.1);
            }
            return;
        }
        // Seitwärts-Schlingern über die eigene Spielzeit statt Date.now() (G-22)
        const ox = this.x;
        this._moveWithCollision(this.look.x * this.speed * dt + Math.sin(this.t * 5.56) * 18 * dt, this.look.y * this.speed * dt, world);
        this.rollA += (this.x - ox) / 42;
        this.popTimer -= dt;
        this.rollTimer -= dt;
        if (this.popTimer <= 0) {
            this.state = 'inflate';
            this.stateT = 0.55;
        } else if (this.rollTimer <= 0) {
            this.rollTimer = this.phase === 1 ? 1.4 : 0.9;
            this.hopSX = this.x;
            this.hopSY = this.y;
            this.hopTX = this.x + randRange(-24, 24);
            this.hopTY = this.y + randRange(-24, 24);
            this.state = 'hop';
            this.stateT = 0.28;
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        const lk = this.look;
        const st = this.state;
        const p2 = this.phase === 2;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, cy);
        const R = 42 * this.inflate;
        const k = st === 'inflate' ? clamp(1 - this.stateT / 0.55, 0, 1) : 0;
        if (st === 'inflate') LateWorldArt.rays(ctx, cx, cy, p2 ? 10 : 6, 0, R + 6, R + 64, k, '#ff3d5a');
        let hop = 0, sx = 1, sy = 1;
        if (st === 'hop') {
            const h = clamp(1 - this.stateT / 0.28, 0, 1);
            hop = Math.sin(h * Math.PI) * 12;
            sx = 0.96; sy = 1.05;
        } else if (st === 'chase') {
            const b = Math.abs(Math.sin(this.t * 4));
            hop = b * 3;
            if (b < 0.15) { sx = 1.04; sy = 0.96; }
        }
        if (this.dead) { sx = 1.08; sy = 0.86; }    // Luft raus
        const step = st === 'chase' ? Math.sin(this.t * 8) : 0;
        ctx.translate(cx, by);
        this._boot(ctx, -22, Math.max(0, step) * 3);
        this._boot(ctx, 22, Math.max(0, -step) * 3);
        ctx.translate(0, -hop);
        const bcy = -8 - R;
        const swing = st === 'chase' ? Math.sin(this.t * 8) * 4 : (st === 'inflate' ? -6 * k : 0);
        const gy = bcy + 10;
        Art.limb(ctx, -R * 0.8, bcy + 8, -(R + 10), gy + swing, 6, '#ffffff', { lineWidth: 1.6 });
        Art.limb(ctx, R * 0.8, bcy + 8, R + 10, gy - swing, 6, '#ffffff', { lineWidth: 1.6 });
        // Ball (staucht um den Aufsetzpunkt)
        ctx.save();
        ctx.translate(0, bcy + R);
        ctx.scale(sx, sy);
        ctx.translate(0, -R);
        Art.body(ctx, 0, 0, R, R, '#ffffff', { outline: '#26325c', lineWidth: 2.6, highlight: false });
        ctx.save();
        ctx.clip();
        ctx.save();
        ctx.rotate(this.rollA);
        ctx.fillStyle = '#26325c';
        ctx.beginPath();
        LateWorldArt.poly(ctx, 0, 0, R * 0.26, 5, -Math.PI / 2);
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i * TAU) / 5 + TAU / 10;
            LateWorldArt.poly(ctx, Math.cos(a) * R * 0.74, Math.sin(a) * R * 0.74, R * 0.24, 5, a);
        }
        ctx.fill();
        ctx.strokeStyle = '#8f9bc2';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i * TAU) / 5;
            ctx.moveTo(Math.cos(a) * R * 0.26, Math.sin(a) * R * 0.26);
            ctx.lineTo(Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56);
        }
        ctx.stroke();
        ctx.restore();
        // Schweißband
        ctx.fillStyle = '#ff4d5e';
        ctx.beginPath();
        ctx.moveTo(-R - 2, -R * 0.58);
        ctx.quadraticCurveTo(0, -R * 0.98, R + 2, -R * 0.58);
        ctx.lineTo(R + 2, -R * 0.36);
        ctx.quadraticCurveTo(0, -R * 0.76, -R - 2, -R * 0.36);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-R - 2, -R * 0.47);
        ctx.quadraticCurveTo(0, -R * 0.87, R + 2, -R * 0.47);
        ctx.stroke();
        if (p2) {
            // Pflaster und Riss
            ctx.fillStyle = '#ffd9a8';
            ctx.save();
            ctx.translate(R * 0.5, R * 0.2);
            ctx.rotate(0.6);
            ctx.fillRect(-9, -3, 18, 6);
            ctx.rotate(-1.2);
            ctx.fillRect(-9, -3, 18, 6);
            ctx.restore();
            ctx.strokeStyle = '#26325c';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(-R * 0.62, R * 0.1);
            ctx.lineTo(-R * 0.48, R * 0.24);
            ctx.lineTo(-R * 0.58, R * 0.36);
            ctx.lineTo(-R * 0.42, R * 0.5);
            ctx.stroke();
        }
        if (k > 0) {
            // rot vor Anstrengung
            const prevA = ctx.globalAlpha;
            ctx.globalAlpha = prevA * k * 0.28;
            ctx.fillStyle = '#ff4d5e';
            ctx.fillRect(-R, -R, 2 * R, 2 * R);
            ctx.globalAlpha = prevA;
        }
        ctx.restore();
        Art.shine(ctx, -R * 0.55, -R * 0.12, R * 0.2, R * 0.12, -0.6, 0.45);
        // Ventil
        Art.body(ctx, R * 0.34, -R * 0.93, 3.4, 2.4, '#3d3a6b', { lineWidth: 1, highlight: false });
        // Gesicht
        const ex = lk.x * 6, ey = -R * 0.1;
        if (this.dead) LateWorldArt.xEyes(ctx, ex, ey, 6, 14);
        else Art.eyes(ctx, ex, ey, 8.5, { gap: 14, look: lk, angry: true, iris: p2 ? '#ff2d55' : '#2f7bff', seed: this.seed });
        const mouth = this.dead ? 'o' : (st === 'inflate' ? 'o' : (st === 'hop' ? 'grin' : 'teeth'));
        Art.mouth(ctx, lk.x * 5, R * 0.36, st === 'inflate' ? 12 : 22, mouth);
        Art.blush(ctx, ex, R * 0.2, 5 + k * 3, 22);
        ctx.restore();
        // Torwart-Handschuhe
        this._glove(ctx, -(R + 12), gy + swing, -1);
        this._glove(ctx, R + 12, gy - swing, 1);
        if (p2 && !this.dead) {
            // Dampf
            const prevA = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 2; i++) {
                const s = (t * 1.1 + i * 0.5) % 1;
                ctx.globalAlpha = prevA * (1 - s) * 0.5;
                ctx.beginPath();
                ctx.arc((i ? 1 : -1) * (R * 0.6 + s * 8), bcy - R * 0.8 - s * 16, 3 + s * 5, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prevA;
        }
        ctx.restore();
    }
    _boot(ctx, x, lift) {
        Art.box(ctx, x - 14, -11 - lift, 28, 11, 5.5, '#ff4d5e', { lineWidth: 2 });
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            ctx.moveTo(x - 7 + i * 5, -9 - lift);
            ctx.lineTo(x - 9 + i * 5, -4 - lift);
        }
        ctx.stroke();
        ctx.fillStyle = '#3d3a6b';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            ctx.moveTo(x + i * 9 + 1.6, -0.2 - lift);
            ctx.arc(x + i * 9, -0.2 - lift, 1.6, 0, TAU);
        }
        ctx.fill();
    }
    _glove(ctx, x, y, s) {
        Art.body(ctx, x + s * 2, y - 4, 3.6, 5.2, '#39d98a', { lineWidth: 1.6, rot: -0.4 * s, highlight: false });
        Art.body(ctx, x, y, 10, 11.5, '#39d98a', { lineWidth: 2 });
        ctx.strokeStyle = Art.ink('#39d98a');
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 9);
        ctx.lineTo(x - 3, y - 3);
        ctx.moveTo(x + 3, y - 9);
        ctx.lineTo(x + 3, y - 3);
        ctx.stroke();
        Art.box(ctx, x - 8, y + 7, 16, 6, 3, '#ffffff', { lineWidth: 1.6, highlight: false });
    }
}

// Schrott-Waschbär (Welt 21): Topf-Helm, Blechdosen-Panzer; hebt die Schraube vor dem Wurf leuchtend an.
class ScrapRaccoon extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 24, 20);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 54;
        this.throwTimer = 0.9;
        this.contactDamage = true;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
        this.fxColor = '#9aa6d6';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.face = 1;
        this.windup = 0;
        this.moving = false;
        this.walkT = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (dx > 3) this.face = 1; else if (dx < -3) this.face = -1;
        this.windup = 0;
        this.moving = false;
        if (dist < 260) {
            this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
            this.moving = true;
            this.walkT += dt;
            this.throwTimer -= dt;
            if (this.throwTimer < 0.35) this.windup = clamp(1 - this.throwTimer / 0.35, 0, 1);
            if (this.throwTimer <= 0) {
                this.throwTimer = 2.2;
                const p = LateWorldArt.shoot(mx, my, Math.atan2(dy, dx), 155, 50, LateWorldArt.shotNut);
                if (p) p.bouncesLeft = 0;
            }
        } else {
            this.throwTimer = Math.max(0.35, this.throwTimer);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        if (this.dead && !LateWorldArt.deathPop(ctx, this, cx, cy)) { ctx.restore(); return; }
        const f = this.face;
        const lk = this.look;
        const w = this.dead ? 0 : this.windup;
        const fur = '#9aa6d6';
        const dark = '#3d3a6b';
        const run = this.moving ? Math.sin(this.walkT * 14) : 0;
        ctx.translate(cx, by);
        // Ringelschwanz
        ctx.save();
        ctx.translate(-7 * f, -8);
        ctx.rotate((-0.75 + Math.sin(t * 5 + this.seed) * 0.12) * f);
        Art.body(ctx, 0, -6.5, 4.6, 8.2, fur, { highlight: false, lineWidth: 1.3 });
        ctx.save();
        ctx.clip();
        ctx.fillStyle = dark;
        ctx.fillRect(-6, -15.5, 12, 3.4);
        ctx.fillRect(-6, -9.6, 12, 2.3);
        ctx.fillRect(-6, -4.8, 12, 2.3);
        ctx.restore();
        ctx.restore();
        // Pfoten
        LateWorldArt.blob(ctx, (-4 + run * 2) * f, -1.6 - Math.max(0, run) * 1.2, 2.6, 1.7, dark, 1);
        LateWorldArt.blob(ctx, (4 - run * 2) * f, -1.6 - Math.max(0, -run) * 1.2, 2.6, 1.7, dark, 1);
        // Körper mit Dosendeckel als Brustpanzer
        Art.body(ctx, -1.5 * f, -7.5, 8.6, 6.6, fur);
        Art.body(ctx, 0.5 * f, -8.2, 4.6, 4.6, '#c9d6ec', { outline: '#56649a', lineWidth: 1.2 });
        Art.ring(ctx, 0.5 * f, -8.2, 2.8, '#8d9bc4', 0.9, 1);
        ctx.fillStyle = '#ff4d5e';
        ctx.beginPath();
        ctx.arc(0.5 * f, -8.2, 1.2, 0, TAU);
        ctx.fill();
        // Arm: hebt vor dem Wurf die glühende Schraubenmutter
        const ax = w > 0 ? (-2 - w * 2) * f : 6.5 * f, ay = w > 0 ? -16 - w * 4 : -6.5;
        Art.limb(ctx, 3 * f, -10, ax, ay, 2.2, dark, { lineWidth: 1 });
        if (w > 0) {
            Art.glow(ctx, ax, ay - 2, 5 + w * 6, '#ff9f43', 0.4 + 0.5 * w);
            ctx.beginPath();
            LateWorldArt.poly(ctx, ax, ay - 2, 2.6 + w, 6, t * 8);
            ctx.fillStyle = '#c9d6ec';
            ctx.fill();
            ctx.strokeStyle = '#3b3f6b';
            ctx.lineWidth = 0.9;
            ctx.stroke();
        }
        // Kopf: spitze Ohren, schwarze Maske, weiße Schnauze, kleiner Kochtopf als Helm
        const hx = 6.5 * f, hy = -14.5;
        ctx.beginPath();
        ctx.moveTo(hx - 7 * f, hy - 2);
        ctx.lineTo(hx - 6 * f, hy - 10.5);
        ctx.lineTo(hx - 1.5 * f, hy - 5.5);
        ctx.closePath();
        ctx.moveTo(hx + 1.5 * f, hy - 5.8);
        ctx.lineTo(hx + 5 * f, hy - 11);
        ctx.lineTo(hx + 7 * f, hy - 3);
        ctx.closePath();
        ctx.fillStyle = fur;
        ctx.fill();
        ctx.strokeStyle = Art.ink(fur);
        ctx.lineWidth = 1.1;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.fillStyle = '#ff9fc1';
        ctx.beginPath();
        ctx.moveTo(hx - 5.6 * f, hy - 3.5);
        ctx.lineTo(hx - 5.4 * f, hy - 8.4);
        ctx.lineTo(hx - 2.9 * f, hy - 5.6);
        ctx.closePath();
        ctx.moveTo(hx + 2.9 * f, hy - 5.8);
        ctx.lineTo(hx + 4.9 * f, hy - 9);
        ctx.lineTo(hx + 5.9 * f, hy - 4.2);
        ctx.closePath();
        ctx.fill();
        Art.body(ctx, hx, hy, 7.8, 6.6, fur);
        ctx.fillStyle = '#eef0ff';
        ctx.beginPath();
        ctx.ellipse(hx + 0.6 * f, hy - 3.6, 5.2, 1.6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2e2a5a';
        ctx.beginPath();
        ctx.ellipse(hx + 0.8 * f, hy - 0.3, 6.9, 2.9, 0, 0, TAU);
        ctx.fill();
        LateWorldArt.blob(ctx, hx + 5 * f, hy + 2.4, 3.8, 2.8, '#f4f1ff', 1.1);
        Art.body(ctx, hx + 8.2 * f, hy + 1.5, 1.4, 1.1, '#2e2a5a', { lineWidth: 0.8 });
        if (this.dead) LateWorldArt.xEyes(ctx, hx + 0.8 * f, hy - 0.4, 1.5, 2.9);
        else Art.eyes(ctx, hx + 0.8 * f + lk.x * 0.5, hy - 0.4, 2.1, { gap: 2.9, look: lk, angry: true, seed: this.seed });
        Art.box(ctx, hx - 1.5 * f - 4, hy - 10.4, 8, 3.8, 1.6, '#e0823b', { lineWidth: 1.1 });
        Art.limb(ctx, hx - 5.2 * f, hy - 8.8, hx - 9.2 * f, hy - 9.8, 1.4, '#6b3a12', { lineWidth: 0.8 });
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 10);
    }
}

// Riesen-Waschbär (Welt 21, letzter Boss): König des Schrottplatzes mit Kronkorken-Krone, Umhang,
// Schraubenschlüssel-Zepter, Mülltonnen-Panzer und Greifarm. Wirft drei Zahnräder (Ziellinien warnen vor),
// weicht mit Hopsern aus (mit Kollision statt Versetzen, G-03). Phase 2: Panzer beschädigt, rote Augen, Magnet-Schrott.
class BossScrapRaccoon extends Enemy {
    constructor(x, y) {
        super(x, y, 120, 88);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 26;
        this.isBoss = true;
        this.contactDamage = false;
        this.fxColor = '#9aa6d6';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.face = 1;
        this.state = 'intro';    // intro → chase → scurry → chase
        this.introTimer = 2;
        this.stateT = 0;
        this.throwTimer = 2;
        this.rushTimer = 5;
        this.throwAnim = 0;
        this.phase = 1;
        this.walkT = 0;
        this.hopSX = 0; this.hopSY = 0; this.hopTX = 0; this.hopTY = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 40) this.phase = 2;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.throwAnim = Math.max(0, this.throwAnim - dt);
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'scurry') {
            this.stateT -= dt;
            const k = clamp(1 - this.stateT / 0.3, 0, 1);
            // Ausweich-Hopser über die Wand-Kollision statt Versetzen (G-03)
            this._moveWithCollision(this.hopSX + (this.hopTX - this.hopSX) * k - this.x,
                this.hopSY + (this.hopTY - this.hopSY) * k - this.y, world);
            if (this.stateT <= 0) {
                this.state = 'chase';
                LateWorldArt.shake(3, 0.12);
                if (typeof FX !== 'undefined') {
                    FX.burst(this.centerX(), this.y + this.h - 4, 'rgba(235,225,255,0.9)', 8, 80, 0.45, { kind: 'smoke', size: 5 });
                }
            }
            return;
        }
        if (dx > 24) this.face = 1; else if (dx < -24) this.face = -1;
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.walkT += dt;
        this.throwTimer -= dt;
        this.rushTimer -= dt;
        if (this.throwTimer <= 0) {
            this.throwTimer = this.phase === 1 ? 2 : 1.3;
            const a = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i++) LateWorldArt.shoot(mx, my, a + i * 0.18, 170, 55, LateWorldArt.shotGear);
            this.throwAnim = 0.25;
            if (typeof FX !== 'undefined') FX.burst(mx + this.face * 40, my - 20, ['#ffb347', '#ffffff'], 6, 110, 0.35, { kind: 'spark' });
        }
        if (this.rushTimer <= 0 && this.throwTimer > 0.6) {
            // gleicher Takt wie bisher (5 s / 3,5 s), der Hopser gehört dazu
            this.rushTimer = (this.phase === 1 ? 5 : 3.5) - 0.3;
            this.hopSX = this.x;
            this.hopSY = this.y;
            this.hopTX = this.x + randRange(-60, 60);
            this.hopTY = this.y + randRange(-40, 40);
            this.state = 'scurry';
            this.stateT = 0.3;
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const by = pos.y + this.h;
        const t = Art.time;
        const f = this.face;
        const lk = this.look;
        const st = this.state;
        const p2 = this.phase === 2;
        const fur = p2 ? '#8d97cf' : '#9aa6d6';
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, cy);
        // Wurf-Vorwarnung: drei Ziellinien in die Flugrichtungen
        const tk = st === 'chase' && this.throwTimer < 0.5 && !this.dead ? 1 - this.throwTimer / 0.5 : 0;
        if (tk > 0) this._aimLines(ctx, cx, cy, tk);
        if (st === 'scurry') LateWorldArt.speedLines(ctx, cx, cy, Math.atan2(this.hopTY - this.hopSY, this.hopTX - this.hopSX), 30, 22);
        const walk = st === 'chase' ? this.walkT : 0;
        const step = Math.sin(walk * 7);
        const bob = -Math.abs(step) * 2 + (st === 'intro' ? Math.sin(t * 2.2) * 1.5 : 0);
        ctx.translate(cx, by + (st === 'scurry' ? 3 : 0));
        this._tail(ctx, f, fur, t);
        this._cape(ctx, f, bob, t);
        this._scepter(ctx, f, bob, fur);
        this._leg(ctx, -13 * f, Math.max(0, step) * 4, Art.dark(fur, 0.2));
        // runder Körper, heller Bauch, Mülltonnen-Panzer
        Art.body(ctx, 0, -34 + bob, 31, 30, fur, { lineWidth: 2.4 });
        ctx.fillStyle = '#dde2f7';
        ctx.beginPath();
        ctx.ellipse(4 * f, -26 + bob, 18, 16, 0, 0, TAU);
        ctx.fill();
        this._armor(ctx, f, bob, p2, t);
        this._leg(ctx, 13 * f, Math.max(0, -step) * 4, fur);
        // Greifarm (hebt vor dem Wurf drei glühende Zahnräder)
        let clawX = 42 * f, clawY = -28 + step * 3 + bob;
        if (tk > 0) { clawX = (42 + tk * 4) * f; clawY = -40 - tk * 42; }
        if (this.throwAnim > 0) { clawX = 54 * f; clawY = -50; }
        this._arm(ctx, 18 * f, -50 + bob, clawX, clawY, f, tk);
        this._head(ctx, f, fur, lk, p2, bob);
        if (p2 && !this.dead) {
            // Magnet-Schrott kreist um den Körper
            for (let i = 0; i < 2; i++) {
                const a = t * 1.6 + i * Math.PI;
                const gx = Math.cos(a) * 60, gy = -44 + Math.sin(a) * 18;
                ctx.beginPath();
                LateWorldArt.gearPath(ctx, gx, gy, 6, 7, t * 4 + i);
                ctx.fillStyle = '#c9d6ec';
                ctx.fill();
                ctx.strokeStyle = '#3b3f6b';
                ctx.lineWidth = 1.3;
                ctx.lineJoin = 'round';
                ctx.stroke();
            }
        }
        ctx.restore();
    }
    // Drei Ziellinien (Mitte ±0,18) von der Körpermitte aus
    _aimLines(ctx, cx, cy, k) {
        const a = Math.atan2(this.look.y, this.look.x);
        const prevA = ctx.globalAlpha;
        ctx.strokeStyle = '#ff3d5a';
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.globalAlpha = prevA * (0.25 + 0.55 * k);
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            const ai = a + i * 0.18;
            ctx.moveTo(cx + Math.cos(ai) * 40, cy + Math.sin(ai) * 40);
            ctx.lineTo(cx + Math.cos(ai) * (60 + 90 * k), cy + Math.sin(ai) * (60 + 90 * k));
        }
        ctx.stroke();
        ctx.globalAlpha = prevA;
    }
    // buschiger Ringelschwanz hinter dem Rücken
    _tail(ctx, f, fur, t) {
        ctx.save();
        ctx.translate(-24 * f, -26);
        ctx.rotate((-0.7 + Math.sin(t * 2.4 + this.seed) * 0.08) * f);
        Art.body(ctx, 0, -24, 15, 30, fur, { lineWidth: 2.2, highlight: false });
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#3d3a6b';
        ctx.fillRect(-16, -56, 32, 12);
        ctx.fillRect(-16, -34, 32, 7);
        ctx.fillRect(-16, -17, 32, 7);
        ctx.fillRect(-16, 0, 32, 6);
        ctx.restore();
        Art.shine(ctx, -5, -36, 3.5, 8, -0.2, 0.3);
        ctx.restore();
    }
    // roter Königsumhang mit Goldsaum (weht leicht nach hinten)
    _cape(ctx, f, bob, t) {
        const w = Math.sin(t * 2.6 + this.seed) * 3;
        Art.shape(ctx, c => {
            c.moveTo(-2 * f, -66 + bob);
            c.quadraticCurveTo(-40 * f, -64 + bob, -56 * f + w * f, -6);
            c.lineTo(-48 * f, -1);
            c.lineTo(-42 * f, -7);
            c.lineTo(-35 * f, 0);
            c.lineTo(-28 * f, -6);
            c.lineTo(-16 * f, -14);
            c.closePath();
        }, { x: f > 0 ? -58 : 2, y: -66, w: 56, h: 66 }, '#e8283f', { lineWidth: 2 });
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-6 * f, -63 + bob);
        ctx.quadraticCurveTo(-38 * f, -60 + bob, -53 * f + w * f, -8);
        ctx.stroke();
    }
    // hinterer Arm mit goldenem Schraubenschlüssel als Zepter
    _scepter(ctx, f, bob, fur) {
        const px = -32 * f, py = -40 + bob;
        Art.limb(ctx, -36 * f, -6, -28 * f, -86 + bob, 5.5, '#ffc53d', { lineWidth: 1.8 });
        const hx = -28 * f, hy = -91 + bob;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(hx, hy, 6.5, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + TAU);
        ctx.strokeStyle = Art.ink('#ffd23f');
        ctx.lineWidth = 8.6;
        ctx.stroke();
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 5.4;
        ctx.stroke();
        Art.sparkle(ctx, hx - 3, hy - 3, 3, '#ffffff', 0.5 + 0.5 * Math.sin(Art.time * 3 + this.seed));
        Art.limb(ctx, -16 * f, -52 + bob, px, py, 8, Art.dark(fur, 0.2), { lineWidth: 1.8 });
        Art.body(ctx, px, py, 5.2, 5.2, '#3d3a6b', { lineWidth: 1.6, highlight: false });
    }
    _leg(ctx, x, lift, col) {
        Art.body(ctx, x, -14 - lift, 11, 10, col, { lineWidth: 2 });
        // Blechdosen-Stiefel
        Art.box(ctx, x - 9, -10 - lift, 18, 10, 3, '#a9bdd6', { lineWidth: 1.8 });
        ctx.strokeStyle = '#6b7fae';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - 9, -6.5 - lift);
        ctx.lineTo(x + 9, -6.5 - lift);
        ctx.moveTo(x - 9, -3.5 - lift);
        ctx.lineTo(x + 9, -3.5 - lift);
        ctx.stroke();
    }
    // Mülltonnen-Brustpanzer mit Kupfer-Flicken; in Phase 2 verbeult mit Funken
    _armor(ctx, f, bob, p2, t) {
        const ax = -17 + 3 * f;
        const y0 = -58 + bob;
        Art.box(ctx, ax, y0, 34, 30, 8, '#a9bdd6', { lineWidth: 2.2 });
        ctx.strokeStyle = '#7d91b8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
            ctx.moveTo(ax + i * 8.5, y0 + 4);
            ctx.lineTo(ax + i * 8.5, y0 + 26);
        }
        ctx.stroke();
        ctx.fillStyle = '#5f6fa8';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const rx = ax + (i % 2 ? 30 : 4), ry = y0 + (i < 2 ? 4 : 26);
            ctx.moveTo(rx + 1.4, ry);
            ctx.arc(rx, ry, 1.4, 0, TAU);
        }
        ctx.fill();
        Art.box(ctx, ax + 17 + 4 * f - 6, y0 + 11, 12, 9, 2, '#e0823b', { lineWidth: 1.4 });
        if (p2) {
            ctx.strokeStyle = '#3b3f6b';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(ax + 6, y0 + 5);
            ctx.lineTo(ax + 11, y0 + 12);
            ctx.lineTo(ax + 7, y0 + 17);
            ctx.lineTo(ax + 13, y0 + 23);
            ctx.stroke();
            const n = Math.floor(t * 7);
            const sx = ax + 5 + ((n * 37) % 24), sy = y0 + 5 + ((n * 53) % 20);
            Art.sparkle(ctx, sx, sy, 5, '#fff6a8');
        }
    }
    // mechanischer Greifarm mit drei goldenen Fingern
    _arm(ctx, sx, sy, x, y, f, k) {
        const ex = (sx + x) / 2 + 6 * f, ey = (sy + y) / 2 + 8;
        Art.limb(ctx, sx, sy, ex, ey, 7, '#8fa3bf', { lineWidth: 1.8 });
        Art.limb(ctx, ex, ey, x, y, 6, '#8fa3bf', { lineWidth: 1.8 });
        Art.body(ctx, ex, ey, 4.6, 4.6, '#6b7fae', { lineWidth: 1.6, highlight: false });
        const a = Math.atan2(y - ey, x - ex);
        for (let i = -1; i <= 1; i++) {
            const fa = a + i * 0.62;
            Art.limb(ctx, x, y, x + Math.cos(fa) * 8, y + Math.sin(fa) * 8, 2.8, '#ffc53d', { lineWidth: 1.2 });
        }
        Art.body(ctx, x, y, 4, 4, '#ffd23f', { lineWidth: 1.4, highlight: false });
        if (k > 0) {
            // drei glühende Zahnräder im Greifer (ein gemeinsames Leuchten)
            Art.glow(ctx, x, y - 8, 12 + k * 8, '#ff9f43', 0.45 + k * 0.45);
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) {
                LateWorldArt.gearPath(ctx, x + i * 7, y - 9 + Math.abs(i) * 3, 4.2, 6, Art.time * 8 + i);
            }
            ctx.fillStyle = '#ffb347';
            ctx.fill();
            ctx.strokeStyle = '#6b3a12';
            ctx.lineWidth = 1;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
    }
    _head(ctx, f, fur, lk, p2, bob) {
        const hx = 8 * f, hy = -72 + bob;
        // Ohren
        ctx.beginPath();
        ctx.moveTo(hx - 22 * f, hy - 8);
        ctx.lineTo(hx - 18 * f, hy - 28);
        ctx.lineTo(hx - 7 * f, hy - 17);
        ctx.closePath();
        ctx.moveTo(hx + 4 * f, hy - 19);
        ctx.lineTo(hx + 14 * f, hy - 31);
        ctx.lineTo(hx + 20 * f, hy - 13);
        ctx.closePath();
        ctx.fillStyle = fur;
        ctx.fill();
        ctx.strokeStyle = Art.ink(fur);
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.fillStyle = '#ff9fc1';
        ctx.beginPath();
        ctx.moveTo(hx - 18.5 * f, hy - 11);
        ctx.lineTo(hx - 17 * f, hy - 23);
        ctx.lineTo(hx - 10.5 * f, hy - 16.5);
        ctx.closePath();
        ctx.moveTo(hx + 7 * f, hy - 18);
        ctx.lineTo(hx + 13.5 * f, hy - 26);
        ctx.lineTo(hx + 17 * f, hy - 14.5);
        ctx.closePath();
        ctx.fill();
        Art.body(ctx, hx, hy, 26, 21, fur, { lineWidth: 2.4 });
        // Waschbär-Maske
        ctx.fillStyle = '#2e2a5a';
        ctx.beginPath();
        ctx.moveTo(hx - 24 * f, hy - 2);
        ctx.quadraticCurveTo(hx, hy - 17, hx + 24 * f, hy - 4);
        ctx.quadraticCurveTo(hx + 26 * f, hy + 5, hx + 16 * f, hy + 6);
        ctx.quadraticCurveTo(hx, hy - 3, hx - 16 * f, hy + 7);
        ctx.quadraticCurveTo(hx - 26 * f, hy + 5, hx - 24 * f, hy - 2);
        ctx.closePath();
        ctx.fill();
        // Schnauze und Mund
        Art.body(ctx, hx + 17 * f, hy + 8, 12, 9, '#f4f1ff', { lineWidth: 1.8 });
        Art.body(ctx, hx + 27 * f, hy + 4.5, 5, 3.8, '#2e2a5a', { lineWidth: 1.2 });
        Art.mouth(ctx, hx + 15 * f, hy + 13, 12, this.dead ? 'o' : 'teeth');
        // Augen
        if (this.dead) {
            LateWorldArt.xEyes(ctx, hx + 1 * f, hy - 1.5, 4, 9.5);
        } else {
            if (p2) Art.glow(ctx, hx + 1 * f, hy - 1.5, 20, '#ff2d55', 0.45);
            Art.eyes(ctx, hx + 1 * f + lk.x * 2, hy - 1.5, 6.4, { gap: 9.5, look: lk, angry: true, iris: p2 ? '#ff2d55' : '#ffd23f', seed: this.seed });
        }
        // Schweißerbrille auf der Stirn
        ctx.strokeStyle = '#3b3f6b';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx - 24 * f, hy - 10);
        ctx.quadraticCurveTo(hx, hy - 19, hx + 23 * f, hy - 13);
        ctx.stroke();
        Art.body(ctx, hx - 7 * f, hy - 15, 5, 4.6, '#7df9ff', { outline: '#3b3f6b', lineWidth: 2.2 });
        Art.body(ctx, hx + 6 * f, hy - 15.5, 4.8, 4.4, '#7df9ff', { outline: '#3b3f6b', lineWidth: 2.2 });
        // Krone aus Kronkorken
        this._crown(ctx, hx - 2 * f, hy - 22, f, this.dead ? 0.55 : 0.12);
    }
    _crown(ctx, x, y, f, tilt) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt * f);
        ctx.scale(1.3, 1.3);
        Art.shape(ctx, BossScrapRaccoon._crownPath, { x: -14, y: -12, w: 28, h: 15 }, '#ffd23f', { lineWidth: 1.6, glossy: true });
        const caps = BossScrapRaccoon.CAPS;
        for (let i = 0; i < caps.length; i += 3) {
            Art.body(ctx, caps[i], caps[i + 1], 2.5, 2.5, caps[i + 2], { lineWidth: 1, highlight: false });
        }
        ctx.restore();
    }
}
BossScrapRaccoon._crownPath = c => {
    c.moveTo(-13, 3);
    c.lineTo(-14, -8);
    c.lineTo(-8, -3);
    c.lineTo(-4, -12);
    c.lineTo(0, -4);
    c.lineTo(4, -12);
    c.lineTo(8, -3);
    c.lineTo(14, -8);
    c.lineTo(13, 3);
    c.closePath();
};
// Kronkorken auf den Kronenzacken (x, y, Farbe)
BossScrapRaccoon.CAPS = [-14, -8, '#ff4d5e', -4, -12, '#4d8bff', 4, -12, '#ff4d5e', 14, -8, '#4d8bff'];
