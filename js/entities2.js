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
