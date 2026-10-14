# Requirements

I would like a zelda-mario crossover where we have mario in a zelda-like 2D world with an isometric camera perspective. So the character needs to be clearly red, ideally also with an M on its cap.

There should not be different levels for now. Just the character. But the level should be large enough that the camera can pan around.

I would like some scattered trees. I would like a sword to hit animals with. Just for the sake of demonstration.

The animals should be: cow, sheep, dog.

I would also like to be able to pick up gems and they make a sound effect when they get picked up.

Also generate some nice music with the scene.

## Blood & Thunder update

- Make the setting darker, more aggressive, and action-oriented.
- Increase movement and combat speed; allow chained sword attacks and sprinting.
- Sword strikes damage animals, show blood-like particles, and kill them at zero health.
- Dead animals drop skulls the player can collect.
- Collecting 10 skulls visibly lengthens the sword and increases its strike reach.
- Replace the gentle music with a more complex, substantially longer rock-like loop.

## Procedural survival update

- Generate the world procedurally on a grid, retaining the isometric perspective.
- Spawn hostile cows, sheep, and dogs on the map; they pursue and damage the player.
- Make kills spectacular explosions with more particles and accompanying explosion sounds; strikes have hit sounds.
- Add a fire circle on Z that surrounds and follows the player, defending against nearby animals for 2 seconds.
- Give the fire circle a 10-second cooldown from activation, with visible feedback.

## Endless world and progression update

- Expand into an arbitrarily large world within practical limits using chunk streaming.
- Increase sword length and hit range on every 10 skull collections, with no tier cap.
- After 10 fire rings, make the next activation a large nuclear explosion that kills nearby animals; repeat the cycle.
- Make animal deaths more spectacular with additional particles and effects.
- Generate hearts throughout the world for health regeneration.
- Add a game-over sound and transition.
- Allow facing, aiming, and sword strikes in every direction.
- At 100 skulls, unlock automatic damaging particles in every direction.
