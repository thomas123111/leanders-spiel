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

class Drone extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 18);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 58;
        this.damage = 1;
        this.contactDamage = true;
        this.detectionRange = 260;
        this.shootTimer = 0;
        this.hoverPhase = Math.random() * Math.PI * 2;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < this.detectionRange) {
            const a = angleBetween(mc, pc);
            const sway = Math.sin(this.hoverPhase) * 24;
            this.hoverPhase += dt * 5;
            this._moveWithCollision(
                Math.cos(a) * this.speed * dt + Math.cos(this.hoverPhase) * sway * dt,
                Math.sin(a) * this.speed * dt + Math.sin(this.hoverPhase * 0.7) * 8 * dt,
                world
            );
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && typeof Game !== 'undefined') {
                this.shootTimer = 2.2;
                Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(a) * 170, Math.sin(a) * 170, 1, 'enemy', 50));
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
        ctx.fillStyle = '#778';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#AAB';
        ctx.beginPath();
        ctx.arc(cx, cy - 1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 2, cy - 9, 4, 3);
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - 8, cy + 5, 4, 2);
        ctx.fillRect(cx + 4, cy + 5, 4, 2);
        ctx.restore();
    }
}

class WalkingMushroom extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 22);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 28;
        this.damage = 1;
        this.contactDamage = true;
        this.sporeTimer = 0;
        this.wobble = Math.random() * Math.PI * 2;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 220) {
            const a = angleBetween(mc, pc);
            this.wobble += dt * 4;
            this._moveWithCollision(
                Math.cos(a) * this.speed * dt + Math.sin(this.wobble) * 8 * dt,
                Math.sin(a) * this.speed * dt,
                world
            );
            this.sporeTimer -= dt;
            if (this.sporeTimer <= 0 && typeof Game !== 'undefined' && dist < 120) {
                this.sporeTimer = 2.6;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 120, Math.sin(a) * 120, 1, 'enemy', 70);
                p.poison = true;
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
        ctx.fillStyle = '#6A4';
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A8C';
        ctx.beginPath();
        ctx.arc(cx, cy - 7, 9, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#DDD';
        ctx.fillRect(cx - 3, cy - 2, 6, 8);
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 6, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

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
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < this.detectionRange) {
            const a = angleBetween(mc, pc);
            this.wingPhase += dt * 16;
            this._moveWithCollision(
                Math.cos(a) * this.speed * dt + Math.cos(this.wingPhase) * 10 * dt,
                Math.sin(a) * this.speed * dt + Math.sin(this.wingPhase * 1.2) * 6 * dt,
                world
            );
            this.diveTimer -= dt;
            if (this.diveTimer <= 0 && dist < 130) {
                this.diveTimer = 1.7;
                this._moveWithCollision(Math.cos(a) * 140 * dt, Math.sin(a) * 140 * dt, world);
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
        ctx.fillStyle = '#485';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#CFC';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#B8E';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 4);
        ctx.lineTo(cx - 14, cy - 8);
        ctx.moveTo(cx + 8, cy - 4);
        ctx.lineTo(cx + 14, cy - 8);
        ctx.stroke();
        ctx.restore();
    }
}

class CrocodileKid extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 22);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 42;
        this.damage = 2;
        this.contactDamage = true;
        this.spitTimer = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 220) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.spitTimer -= dt;
            if (this.spitTimer <= 0 && typeof Game !== 'undefined' && dist < 150) {
                this.spitTimer = 2.4;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 135, Math.sin(a) * 135, 1, 'enemy', 60);
                p.poison = true;
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
        ctx.fillStyle = '#3A6A3A';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 11, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5B8';
        ctx.beginPath();
        ctx.arc(cx + 6, cy - 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 4, cy - 3, 6, 2);
        ctx.fillStyle = '#F44';
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 5, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 2, cy - 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class IcePenguin extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 46;
        this.damage = 1;
        this.contactDamage = true;
        this.shootTimer = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 240) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && typeof Game !== 'undefined') {
                this.shootTimer = 2.8;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 140, Math.sin(a) * 140, 1, 'enemy', 55);
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
        ctx.fillStyle = '#DFF';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9CF';
        ctx.beginPath();
        ctx.arc(cx, cy - 8, 8, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - 2, cy - 4, 4, 4);
        ctx.fillStyle = '#F90';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 1);
        ctx.lineTo(cx + 4, cy + 2);
        ctx.lineTo(cx, cy + 4);
        ctx.fill();
        ctx.restore();
    }
}

class LavaBall extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 20);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 62;
        this.damage = 1;
        this.contactDamage = true;
        this.burnTimer = 0;
        this.pulse = Math.random() * Math.PI * 2;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 240) {
            const a = angleBetween(mc, pc);
            this.pulse += dt * 10;
            this._moveWithCollision(
                Math.cos(a) * this.speed * dt + Math.cos(this.pulse) * 12 * dt,
                Math.sin(a) * this.speed * dt + Math.sin(this.pulse) * 12 * dt,
                world
            );
            this.burnTimer -= dt;
            if (this.burnTimer <= 0 && typeof Game !== 'undefined' && dist < 120) {
                this.burnTimer = 2.0;
                for (let i = 0; i < 4; i++) {
                    const sa = (Math.PI * 2 * i) / 4;
                    Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(sa) * 110, Math.sin(sa) * 110, 1, 'enemy', 45));
                }
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
        ctx.fillStyle = '#F60';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFB000';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFF0A0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 10 + Math.sin(Date.now() / 120 + this.pulse) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
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
