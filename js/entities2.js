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

// â”€â”€ Training Arena Enemies â”€â”€

class TrainingTargetRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 3;
        this.maxHp = 3;
        this.contactDamage = false;
        this.damage = 0;
    }
    update(dt, world) {
        this.baseUpdate(dt, world);
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#999';
        ctx.fillRect(pos.x + 4, pos.y + 4, 16, 16);
        ctx.fillStyle = '#F44';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, this.w, this.h);
        ctx.restore();
    }
}

class TrainingPatrolRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 26);
        this.hp = 5;
        this.maxHp = 5;
        this.contactDamage = false;
        this.damage = 0;
        this.points = [
            { x: x - 30, y: y - 30 },
            { x: x + 30, y: y - 30 },
            { x: x + 30, y: y + 30 },
            { x: x - 30, y: y + 30 }
        ];
        this.targetIndex = 0;
    }
    update(dt, world) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const p = this.points[this.targetIndex];
        const a = Math.atan2(p.y - this.centerY(), p.x - this.centerX());
        this._moveWithCollision(Math.cos(a) * 55 * dt, Math.sin(a) * 55 * dt, world);
        if (vecDist(this.center(), p) < 10) this.targetIndex = (this.targetIndex + 1) % this.points.length;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#7AF';
        ctx.fillRect(pos.x + 3, pos.y + 5, 20, 16);
        ctx.fillStyle = '#222';
        ctx.fillRect(pos.x + 7, pos.y + 10, 12, 5);
        ctx.strokeStyle = '#0AF';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, this.w, this.h);
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class TrainingShooterRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.contactDamage = false;
        this.damage = 0;
        this.shootTimer = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = this.center();
        const dist = vecDist(mc, pc);
        this.shootTimer -= dt;
        if (dist < 260 && this.shootTimer <= 0 && typeof Game !== 'undefined') {
            this.shootTimer = 2.2;
            const a = angleBetween(mc, pc);
            Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(a) * 120, Math.sin(a) * 120, 1, 'enemy', 60));
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#FA7';
        ctx.fillRect(pos.x + 4, pos.y + 4, 16, 16);
        ctx.fillStyle = '#FFF';
        ctx.fillRect(pos.x + 8, pos.y + 9, 8, 4);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F70';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, this.w, this.h);
        ctx.restore();
    }
}

// â”€â”€ World 16: Fruit-Ninja enemies â”€â”€

class AppleNinja extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.contactDamage = true;
        this.rollTimer = 0;
        this.rollCooldown = 2.4;
        this.rolling = false;
        this.rollDir = { x: 0, y: 0 };
        this.facing = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = this.center();
        const dist = vecDist(mc, pc);
        if (this.rolling) {
            this.x += this.rollDir.x * 220 * dt;
            this.y += this.rollDir.y * 220 * dt;
            this.rollTimer -= dt;
            if (this.rollTimer <= 0) this.rolling = false;
            return;
        }
        if (dist < 220) {
            this.facing = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(this.facing) * 55 * dt, Math.sin(this.facing) * 55 * dt, world);
            this.rollCooldown -= dt;
            if (this.rollCooldown <= 0) {
                this.rollCooldown = 2.2;
                this.rollTimer = 0.45;
                this.rolling = true;
                this.rollDir = vecNormalize(vecSub(pc, mc));
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = this.rolling ? '#D44' : '#E55';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2A2';
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 9);
        ctx.lineTo(cx, cy - 15);
        ctx.lineTo(cx + 5, cy - 9);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - 4, cy - 1, 8, 3);
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class KiwiNinja extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 3;
        this.maxHp = 3;
        this.contactDamage = false;
        this.spitTimer = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = this.center();
        const dist = vecDist(mc, pc);
        if (dist < 210) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * 35 * dt, Math.sin(a) * 35 * dt, world);
            this.spitTimer -= dt;
            if (this.spitTimer <= 0 && typeof Game !== 'undefined') {
                this.spitTimer = 2.7;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 130, Math.sin(a) * 130, 1, 'enemy', 50);
                p.slow = true;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#7DBD5B';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A7E27A';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - 3, cy - 2, 6, 2);
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 3, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BossFruitGiant extends Enemy {
    constructor(x, y) {
        super(x, y, 118, 100);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 18;
        this.damage = 3;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.stompTimer = 3.5;
        this.explosionTimer = 0;
        this.triggeredExplosion = false;
        this.phase = 1;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = this.center();
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
            if (this.explosionTimer <= 0 && typeof Game !== 'undefined') {
                for (let i = 0; i < 12; i++) {
                    const a = (Math.PI * 2 * i) / 12;
                    Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(a) * 170, Math.sin(a) * 170, 1, 'enemy', 80));
                }
                if (particles) {
                    for (let i = 0; i < 12; i++) {
                        particles.push(new Particle(mc.x, mc.y, randRange(-80, 80), randRange(-80, 80), '#FFA', 0.6));
                    }
                }
                this.state = 'chase';
            }
            return;
        }
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
        this.stompTimer -= dt;
        if (this.stompTimer <= 0 && typeof Game !== 'undefined') {
            this.stompTimer = this.phase === 1 ? 3.8 : 2.7;
            for (let i = 0; i < 8; i++) {
                const sa = (Math.PI * 2 * i) / 8;
                Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(sa) * 140, Math.sin(sa) * 140, 1, 'enemy', 70));
            }
            if (particles) {
                for (let i = 0; i < 6; i++) particles.push(new Particle(mc.x, mc.y, randRange(-60, 60), randRange(-60, 60), '#F70', 0.5));
            }
            this.state = 'stomp';
            this.stompTimer = this.phase === 1 ? 3.8 : 2.7;
        }
        if (this.hp <= 40) this.phase = 2;
        if (this.state === 'stomp') {
            this.state = 'chase';
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#E48';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 44, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7B3';
        ctx.beginPath();
        ctx.arc(cx - 28, cy - 18, 16, 0, Math.PI * 2);
        ctx.arc(cx + 18, cy - 22, 15, 0, Math.PI * 2);
        ctx.arc(cx + 30, cy + 10, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F90';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 8, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - 11, cy - 2, 22, 4);
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 6, cy - 6, 2, 0, Math.PI * 2);
        ctx.arc(cx + 6, cy - 6, 2, 0, Math.PI * 2);
        ctx.fill();
        if (this.state === 'explode') {
            ctx.strokeStyle = '#FF0';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, 42 + Math.sin(Date.now() / 70) * 4, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FRUCHT-GIGANT', cx, pos.y - 50);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 48, pos.y - 40, 96, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 40 ? '#F90' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 47, pos.y - 39, 94 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

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

class MiniTRex extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 22);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 60;
        this.damage = 1;
        this.contactDamage = true;
        this.lungeTimer = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        const a = angleBetween(mc, pc);
        if (dist < 220) {
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.lungeTimer -= dt;
            if (this.lungeTimer <= 0 && dist < 120) {
                this.lungeTimer = 2.5;
                this._moveWithCollision(Math.cos(a) * 130 * dt, Math.sin(a) * 130 * dt, world);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#7C5';
        ctx.beginPath();
        ctx.ellipse(cx - 2, cy + 1, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5A3';
        ctx.beginPath();
        ctx.arc(cx + 5, cy - 3, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 1, cy - 2, 5, 2);
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx + 3, cy - 4, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Triceratops extends Enemy {
    constructor(x, y) {
        super(x, y, 34, 24);
        this.hp = 9;
        this.maxHp = 9;
        this.speed = 38;
        this.damage = 2;
        this.contactDamage = true;
        this.chargeTimer = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        const a = angleBetween(mc, pc);
        this.chargeTimer -= dt;
        if (dist < 240) {
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            if (this.chargeTimer <= 0 && dist < 160) {
                this.chargeTimer = 3.2;
                this._moveWithCollision(Math.cos(a) * 150 * dt, Math.sin(a) * 150 * dt, world);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#5A9';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7BC';
        ctx.beginPath();
        ctx.arc(cx + 8, cy - 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3A6';
        ctx.fillRect(cx - 14, cy + 1, 12, 4);
        ctx.fillRect(cx - 2, cy + 8, 14, 4);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 1, cy - 2, 5, 2);
        ctx.fillRect(cx + 7, cy - 2, 5, 2);
        ctx.restore();
    }
}

class BossStingRex extends Enemy {
    constructor(x, y) {
        super(x, y, 120, 96);
        this.hp = 90;
        this.maxHp = 90;
        this.speed = 24;
        this.damage = 3;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.roarTimer = 4;
        this.tailTimer = 3;
        this.tailActive = 0;
        this.phase = 1;
    }

    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 45 && this.phase === 1) {
            this.phase = 2;
            this.speed = 32;
            this.tailTimer = 2.2;
        }

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const a = angleBetween(mc, pc);

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }

        if (this.tailActive > 0) {
            this.tailActive -= dt;
            const tailX = this.centerX() - 30;
            const dist = vecDist({ x: tailX, y: this.centerY() }, pc);
            if (dist < 160) {
                player.takeDamage(3, angleBetween({ x: tailX, y: this.centerY() }, pc), 400);
                player.applySlow(1.2, 0.65);
            }
            return;
        }

        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);

        this.roarTimer -= dt;
        this.tailTimer -= dt;
        if (this.roarTimer <= 0) {
            this.roarTimer = this.phase === 1 ? 4.5 : 3.2;
            if (vecDist(mc, pc) < 220) {
                player.applySlow(2.0, 0.55);
                player.takeDamage(1, a, 120);
            }
            if (particles) {
                for (let i = 0; i < 10; i++) {
                    particles.push(new Particle(mc.x, mc.y, randRange(-70, 70), randRange(-70, 70), '#FFDD88', 0.5));
                }
            }
        }

        if (this.tailTimer <= 0) {
            this.tailTimer = this.phase === 1 ? 3.5 : 2.5;
            this.tailActive = 0.8;
            if (typeof Game !== 'undefined') {
                Game.camera.shake(6, 0.2);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#7C4';
        ctx.beginPath();
        ctx.ellipse(cx - 8, cy + 6, 42, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5A3';
        ctx.beginPath();
        ctx.arc(cx + 28, cy - 6, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8DD';
        ctx.beginPath();
        ctx.arc(cx + 18, cy - 12, 6, 0, Math.PI * 2);
        ctx.arc(cx + 30, cy - 12, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 18, cy - 8, 5, 2);
        ctx.fillRect(cx + 30, cy - 8, 5, 2);
        ctx.strokeStyle = '#9F5';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy + 20);
        ctx.lineTo(cx - 70, cy + 10);
        ctx.stroke();
        if (this.tailActive > 0) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(cx - 20, cy + 20);
            ctx.lineTo(cx - 90, cy + 30);
            ctx.stroke();
        }
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STACHEL-T-REX', cx, pos.y - 46);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 36, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 45 ? '#7C4' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 35, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

class TimeClock extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 24, 24);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 52;
        this.contactDamage = true;
        this.detectionRange = 240;
        this.beamTimer = 0;
        this.spin = Math.random() * Math.PI * 2;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.spin += dt * 4;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < this.detectionRange) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.beamTimer -= dt;
            if (this.beamTimer <= 0 && typeof Game !== 'undefined') {
                this.beamTimer = 2.2;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 155, Math.sin(a) * 155, 1, 'enemy', 50);
                p.slow = true;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#CCD';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7EF';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F90';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + Math.cos(this.spin) * 12, cy - 18);
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + Math.cos(this.spin + Math.PI / 2) * 6, cy - 20);
        ctx.stroke();
        if (this.isKeyGhost) {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(cx - 1, cy - 18, 2, 6);
            ctx.beginPath();
            ctx.arc(cx - 1, cy - 20, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class BossTimeSphere extends Enemy {
    constructor(x, y) {
        super(x, y, 110, 110);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 24;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.burstTimer = 2.5;
        this.rollTimer = 4;
        this.phase = 1;
        this.spin = 0;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 40) this.phase = 2;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        this.spin += dt * (this.phase === 1 ? 3 : 5);
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
        this.burstTimer -= dt;
        if (this.burstTimer <= 0 && typeof Game !== 'undefined') {
            this.burstTimer = this.phase === 1 ? 2.5 : 1.6;
            const count = this.phase === 1 ? 8 : 14;
            for (let i = 0; i < count; i++) {
                const sa = (Math.PI * 2 * i) / count + this.spin;
                const p = new Projectile(mc.x, mc.y, Math.cos(sa) * 160, Math.sin(sa) * 160, 1, 'enemy', 55);
                if (this.phase === 2 && i % 3 === 0) p.slow = true;
                Game.projectiles.push(p);
            }
            if (particles) {
                for (let i = 0; i < 8; i++) particles.push(new Particle(mc.x, mc.y, randRange(-70, 70), randRange(-70, 70), '#7EF', 0.5));
            }
        }
        this.rollTimer -= dt;
        if (this.rollTimer <= 0) {
            this.rollTimer = this.phase === 1 ? 4 : 2.5;
            if (typeof Game !== 'undefined') Game.camera.shake(5, 0.15);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#CCD';
        ctx.beginPath();
        ctx.arc(cx, cy, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 12, cy - 10, 8, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx - 12, cy - 10, 3, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy - 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FF0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 46 + Math.sin(this.spin) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#F90';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ZEITKUGEL', cx, pos.y - 46);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 38, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 40 ? '#7EF' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 37, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

class ShadowCrocodileRunner extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 28, 22);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 44;
        this.contactDamage = true;
        this.throwTimer = 0;
        this.spin = 0;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.spin += dt * 6;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 240) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.throwTimer -= dt;
            if (this.throwTimer <= 0 && typeof Game !== 'undefined') {
                this.throwTimer = 2.4;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 145, Math.sin(a) * 145, 1, 'enemy', 55);
                p.bouncesLeft = 1;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#244';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#556';
        ctx.beginPath();
        ctx.arc(cx + 7, cy - 3, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx + 5, cy - 4, 6, 2);
        ctx.fillStyle = '#9F9';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 5, 1.4, 0, Math.PI * 2);
        ctx.arc(cx + 2, cy - 5, 1.4, 0, Math.PI * 2);
        ctx.fill();
        if (this.isKeyGhost) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(cx, cy - 14, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class BossShadowCrocodile extends Enemy {
    constructor(x, y) {
        super(x, y, 118, 86);
        this.hp = 85;
        this.maxHp = 85;
        this.speed = 28;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.whirlTimer = 3.5;
        this.leapTimer = 6;
        this.phase = 1;
        this.whirlT = 0;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 42) this.phase = 2;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'whirl') {
            this.whirlT += dt;
            if (vecDist(mc, pc) < 100) player.takeDamage(2, angleBetween(mc, pc), 180);
            if (this.whirlT > 1.5) {
                this.state = 'chase';
                this.whirlT = 0;
            }
            return;
        }
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
        this.whirlTimer -= dt;
        this.leapTimer -= dt;
        if (this.whirlTimer <= 0 && typeof Game !== 'undefined') {
            this.whirlTimer = this.phase === 1 ? 3.5 : 2.4;
            for (let i = 0; i < 6; i++) {
                const sa = (Math.PI * 2 * i) / 6;
                Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(sa) * 125, Math.sin(sa) * 125, 1, 'enemy', 50));
            }
            this.state = 'whirl';
            this.whirlT = 0;
        }
        if (this.leapTimer <= 0 && typeof Game !== 'undefined') {
            this.leapTimer = this.phase === 1 ? 6 : 4;
            this.x += Math.cos(a) * 140;
            this.y += Math.sin(a) * 140;
            Game.camera.shake(5, 0.15);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#345';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 40, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#567';
        ctx.beginPath();
        ctx.arc(cx + 20, cy - 6, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F44';
        ctx.beginPath();
        ctx.arc(cx + 24, cy - 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9F9';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy + 10);
        ctx.lineTo(cx - 70, cy + 2);
        ctx.stroke();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SCHATTEN-KROKODIL', cx, pos.y - 44);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 36, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 42 ? '#4F4' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 35, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

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
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 250) {
            const a = angleBetween(mc, pc);
            this.rollT += dt * 9;
            this._moveWithCollision(Math.cos(a) * this.speed * dt + Math.sin(this.rollT) * 10 * dt, Math.sin(a) * this.speed * dt, world);
            if (dist < 90 && typeof Game !== 'undefined') {
                player.takeDamage(1, a, 140);
                Game.camera.shake(2, 0.08);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#F90';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F55';
        ctx.beginPath();
        ctx.arc(cx, cy - 9, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.fillRect(cx - 4, cy - 2, 8, 2);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 2, 1.3, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 2, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BossFootball extends Enemy {
    constructor(x, y) {
        super(x, y, 128, 92);
        this.hp = 90;
        this.maxHp = 90;
        this.speed = 20;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.popTimer = 2.8;
        this.rollTimer = 1.4;
        this.inflate = 1;
        this.phase = 1;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 45) this.phase = 2;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'pop') {
            this.inflate += dt * 3;
            if (this.inflate > 1.35) {
                this.state = 'chase';
                this.popTimer = this.phase === 1 ? 2.8 : 1.9;
            }
            return;
        }
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt + Math.sin(Date.now() / 180) * 18 * dt, Math.sin(a) * this.speed * dt, world);
        this.rollTimer -= dt;
        this.popTimer -= dt;
        if (this.popTimer <= 0 && typeof Game !== 'undefined') {
            this.state = 'pop';
            this.inflate = 0.9;
            for (let i = 0; i < (this.phase === 1 ? 6 : 10); i++) {
                const sa = (Math.PI * 2 * i) / (this.phase === 1 ? 6 : 10);
                Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(sa) * 150, Math.sin(sa) * 150, 1, 'enemy', 50));
            }
            if (particles) {
                for (let i = 0; i < 8; i++) particles.push(new Particle(mc.x, mc.y, randRange(-80, 80), randRange(-80, 80), '#F55', 0.4));
            }
        }
        if (this.rollTimer <= 0) {
            this.rollTimer = this.phase === 1 ? 1.4 : 0.9;
            this.x += randRange(-24, 24);
            this.y += randRange(-24, 24);
            if (typeof Game !== 'undefined') Game.camera.shake(4, 0.1);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#8B2';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 46 * this.inflate, 34 * this.inflate, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D22';
        ctx.beginPath();
        ctx.arc(cx, cy - 28, 16 * this.inflate, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.fillRect(cx - 14, cy - 2, 28, 4);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx - 8, cy - 6, 2, 0, Math.PI * 2);
        ctx.arc(cx + 8, cy - 6, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FUßBALL', cx, pos.y - 44);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 36, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 45 ? '#F90' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 35, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

class ScrapRaccoon extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 24, 20);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 54;
        this.throwTimer = 0;
        this.contactDamage = true;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 260) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.throwTimer -= dt;
            if (this.throwTimer <= 0 && typeof Game !== 'undefined') {
                this.throwTimer = 2.2;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 155, Math.sin(a) * 155, 1, 'enemy', 50);
                p.bouncesLeft = 0;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#A98';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EEE';
        ctx.beginPath();
        ctx.arc(cx + 5, cy - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 3, cy - 5, 4, 2);
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 4, 1.3, 0, Math.PI * 2);
        ctx.arc(cx + 1, cy - 4, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BossScrapRaccoon extends Enemy {
    constructor(x, y) {
        super(x, y, 120, 88);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 26;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.throwTimer = 2;
        this.rushTimer = 5;
        this.phase = 1;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 40) this.phase = 2;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
        this.throwTimer -= dt;
        this.rushTimer -= dt;
        if (this.throwTimer <= 0 && typeof Game !== 'undefined') {
            this.throwTimer = this.phase === 1 ? 2 : 1.3;
            for (let i = -1; i <= 1; i++) {
                const sa = a + i * 0.18;
                const p = new Projectile(mc.x, mc.y, Math.cos(sa) * 170, Math.sin(sa) * 170, 1, 'enemy', 55);
                Game.projectiles.push(p);
            }
            if (particles) {
                for (let i = 0; i < 8; i++) particles.push(new Particle(mc.x, mc.y, randRange(-70, 70), randRange(-70, 70), '#A98', 0.4));
            }
        }
        if (this.rushTimer <= 0) {
            this.rushTimer = this.phase === 1 ? 5 : 3.5;
            this.x += randRange(-60, 60);
            this.y += randRange(-40, 40);
            if (typeof Game !== 'undefined') Game.camera.shake(5, 0.15);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#8A7';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 42, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DCC';
        ctx.beginPath();
        ctx.arc(cx + 22, cy - 6, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WASCHBÄR', cx, pos.y - 42);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 34, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 40 ? '#A9F' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 33, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}
