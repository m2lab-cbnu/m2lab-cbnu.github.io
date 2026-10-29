// Insight cards: one for each challenge, so the passport keeps what you found out, in a sentence.
// Ids are "<experiment>.<idea>". The text is written for someone meeting the idea for the first time.

export const CARDS = {
  // 1F · pendulum
  'pendulum.mass': { floor: 1, title: 'Mass does not set the beat', text: 'A heavier bob is pulled harder, but it is also harder to move. The two cancel, so heavy and light bobs swing in time.' },
  'pendulum.length': { floor: 1, title: 'Four times longer, twice as slow', text: 'The swing time grows with the square root of the length: T = 2π√(L/g).' },
  'pendulum.moon': { floor: 1, title: 'Weaker gravity, slower swing', text: 'On the Moon gravity is about six times weaker, so a pendulum takes about 2.5 times longer per swing.' },
  'pendulum.angle': { floor: 1, title: 'Big swings are a bit slower', text: 'For small swings the time hardly depends on how far you pull. At 60° each swing takes about 7% longer.' },
  // 1F · launcher
  'launcher.angle45': { floor: 1, title: '45° goes farthest (without air)', text: 'Low shots come down too soon, high shots move too slowly sideways. In a vacuum 45° is best, and 30° and 60° land together.' },
  'launcher.droptime': { floor: 1, title: 'Sideways speed does not change the fall', text: 'A ball dropped and a ball fired sideways from the same height hit the floor at the same moment.' },
  'launcher.airangle': { floor: 1, title: 'In air, aim lower', text: 'Drag takes speed all the way, and high shots spend longer losing it. In air the best angle is below 45°.' },
  'launcher.monkey': { floor: 1, title: 'Aim straight at a falling target', text: 'The ball and the target fall the same distance in the same time, so a shot aimed straight at it still hits.' },
  // 1F · spring and motor
  'spring.mass': { floor: 1, title: 'Heavier bounces slower', text: 'A heavier mass is harder to speed up and slow down, so it bounces more slowly: f = (1/2π)√(k/m).' },
  'spring.fast': { floor: 1, title: 'Shaken too fast, it hardly moves', text: 'Above its own pace a mass cannot keep up: it moves only a little, and opposite to the push.' },
  'spring.phase': { floor: 1, title: 'Resonance is perfect timing', text: 'At resonance the mass lags a quarter turn behind the push, so every push lands while it is moving the same way.' },
  // 1F · air track
  'airtrack.swap': { floor: 1, title: 'Equal masses swap speeds', text: 'In a bouncy crash between equal masses the moving one stops and the other takes its speed, like Newton’s cradle.' },
  'airtrack.half': { floor: 1, title: 'Sticking loses half', text: 'When equal masses stick together, momentum is kept but half the motion energy turns into heat and sound.' },
  'airtrack.bounce': { floor: 1, title: 'Light things bounce off heavy ones', text: 'A light glider hitting a heavy one bounces back, so that the total momentum stays the same.' },
  // 1F · lens bench
  'optics.half': { floor: 1, title: 'Half a lens, the whole picture', text: 'Every part of a lens gets light from every part of the object. Cover half and the picture stays whole, only dimmer.' },
  'optics.2f': { floor: 1, title: 'At twice the focal length: same size', text: 'An object 2f in front of a lens makes an upside-down image of the same size 2f behind it.' },
  'optics.inside': { floor: 1, title: 'Inside the focus: a magnifier', text: 'Closer than the focal length, the rays leave spreading apart. No picture on a screen, but your eye sees a big upright image.' },
  // 1F · vibrating string
  'strings.tension': { floor: 1, title: 'Four times the pull, one octave up', text: 'Wave speed goes as √(tension/mass per metre), and the note with it. Four times the tension doubles the frequency.' },
  'strings.touch': { floor: 1, title: 'A light touch picks out harmonics', text: 'A finger at the middle stops every harmonic that moves there. What is left sounds an octave higher.' },
  'strings.middle': { floor: 1, title: 'Where you pluck shapes the sound', text: 'Plucked at the middle, a string has no even harmonics and sounds soft. Near the end it sounds bright.' },
  // 1F · field table
  'field.null': { floor: 1, title: 'Pushes cancel nearer the small charge', text: 'Between +1 and +4 the field vanishes a third of the way from the +1, because the push falls off as 1/distance².' },
  'field.negative': { floor: 1, title: 'Negative charges roll uphill', text: 'On a voltage landscape a positive charge rolls down and a negative one climbs. Electrons flow towards +.' },
  'field.scale': { floor: 1, title: 'Twice the charges, same pattern', text: 'Doubling every charge doubles every push but keeps its direction, so the field lines keep their shape.' },
  // 2F · magnet and pipes
  'pipe.metal': { floor: 2, title: 'Better conductor, stronger brake', text: 'A falling magnet drives eddy currents in the pipe that push back. The better the metal conducts, the slower the fall.' },
  'pipe.slot': { floor: 2, title: 'Cut the loop, lose the brake', text: 'Eddy currents must flow all the way round. A slot along the pipe breaks every ring and the magnet falls fast.' },
  'pipe.cold': { floor: 2, title: 'Cold copper brakes harder', text: 'Cooled to −196 °C copper conducts about eight times better, so the magnet falls about eight times more slowly.' },
  // 2F · slinky
  'slinky.wait': { floor: 2, title: 'The bottom waits for the news', text: 'Let go of a hanging slinky and the bottom stays put until the collapse travels down and reaches it.' },
  'slinky.cm': { floor: 2, title: 'The centre of mass falls like a stone', text: 'Inside forces cancel for the slinky as a whole, so its centre of mass falls at g, whatever the coils are doing.' },
  'slinky.ball': { floor: 2, title: 'Heavier, it waits longer', text: 'A tennis ball on the bottom stretches the slinky more, so the collapse takes longer to arrive and the ball hovers too.' },
  // 2F · double slit
  'slit.cover': { floor: 2, title: 'Stripes need two waves', text: 'Cover one slit and the stripes vanish. Bright and dark stripes come from the light of two slits adding up in some places and cancelling in others.' },
  'slit.color': { floor: 2, title: 'Shorter waves, closer stripes', text: 'Blue light has shorter waves than red, so its stripes sit closer together. The spacing is λL/d.' },
  'slit.apart': { floor: 2, title: 'Slits apart, stripes together', text: 'Move the slits farther apart and the stripes squeeze closer. Twice the gap, half the spacing.' },
  'slit.photons': { floor: 2, title: 'One photon at a time, still stripes', text: 'Single photons land as single dots, yet thousands of them build the same stripes. Where each can land is set by a wave through both slits.' },
  // 2F · coupled pendulums
  'coupled.stiff': { floor: 2, title: 'A stiffer spring swaps faster', text: 'The spring hands the swing across with a small tug every swing. A stiffer spring tugs harder, so the swap takes fewer swings.' },
  'coupled.mode': { floor: 2, title: 'Two ways to swing with no swapping', text: 'Swinging together or exactly opposite, the pendulums keep their energy. Every other swing is a mix of these two modes.' },
  'coupled.detune': { floor: 2, title: 'Out of tune, only part gets across', text: 'With different lengths the tugs drift out of time, so only part of the energy crosses over, and sooner. Matching paces is resonance.' },
  // 2F · gyroscope
  'gyro.faster': { floor: 2, title: 'More spin, slower turn', text: 'Spin the wheel twice as fast and it takes twice as long to go round the stand: Ω = mgr / (Iω).' },
  'gyro.nospin': { floor: 2, title: 'No spin, no magic', text: 'Without spin there is no angular momentum for gravity’s twist to turn sideways, so the wheel simply falls.' },
  'gyro.torque': { floor: 2, title: 'A bigger twist turns it faster', text: 'More weight far out on the axle means a bigger twist, so the spin arrow is turned faster and the gyroscope goes round sooner.' },
  // 2F · Chladni plate
  'chladni.higher': { floor: 2, title: 'Higher notes, finer patterns', text: 'Each resonance fits a whole number of bending waves on the plate. Higher notes mean shorter waves, so more still lines.' },
  'chladni.nodes': { floor: 2, title: 'Sand marks where nothing moves', text: 'Sand is thrown off the parts of the plate that move and comes to rest on the nodal lines, which stay still.' },
  'chladni.stiff': { floor: 2, title: 'A stiffer plate sings higher', text: 'Bending waves run faster on a plate that is stiffer for its weight, so aluminium plays every pattern at a higher note than brass.' },
  // 3F · spin precession
  'precess.field': { floor: 3, title: 'Twice the field, twice the pace', text: 'A spin goes round its field at f = γB: 28 GHz for every tesla. Double the field and it turns twice as fast.' },
  'precess.resonance': { floor: 3, title: 'Resonance: f = γB', text: 'Microwaves only tip the spin over when they turn at its own pace: 5.6 GHz needs 0.2 T. That is ferromagnetic resonance.' },
  'precess.damping': { floor: 3, title: 'More friction, wider line', text: 'Damping lets a spin answer a wider range of fields, but less strongly: the resonance line gets wider and lower.' },
  // 3F · spin-wave machine
  'chain.shorter': { floor: 3, title: 'Higher frequency, shorter spin waves', text: 'Shorter spin waves twist neighbouring spins more against each other, which costs energy, so they need higher frequencies.' },
  'chain.gap': { floor: 3, title: 'Nothing travels below the gap', text: 'Below f = γB no spin wave exists: the wobble near the antenna cannot travel. Above it, the waves run.' },
  'chain.field': { floor: 3, title: 'A magnet tunes spin waves', text: 'More field lifts the whole dispersion curve, so the same frequency gives longer spin waves.' },
  // 3F · magnons meet photons
  'cavity.swap': { floor: 3, title: 'In tune, they trade energy', text: 'Microwaves in a box and magnons in a sphere, tuned to the same pace, pass their energy back and forth like coupled pendulums.' },
  'cavity.gap': { floor: 3, title: 'Coupled waves never cross', text: 'Where the magnon and the photon would cross, they mix and push apart, leaving a gap of twice the coupling g.' },
  'cavity.lossy': { floor: 3, title: 'Strong coupling needs low loss', text: 'Energy must swap before it leaks away. With too much loss the two peaks blur into one: weak coupling.' },
  // 3F · spin-wave logic
  'logic.cancel': { floor: 3, title: 'Opposite waves cancel', text: 'Two spin waves half a wavelength apart meet crest to trough and cancel. Nothing reaches the lamp.' },
  'logic.xor': { floor: 3, title: 'A delay turns the rule round', text: 'A half-wave delay in one arm makes equal bits cancel and different bits add: an XOR gate.' },
  'logic.majority': { floor: 3, title: 'The majority wins', text: 'Three spin waves meet and the result carries the phase of the majority: a majority gate in a single junction.' },
  // 3F · Kerr microscope
  'domains.grow': { floor: 3, title: 'Fields grow the domains that agree', text: 'Domains pointing along the field grow and the others shrink, so the whole film’s magnetisation follows the field.' },
  'domains.memory': { floor: 3, title: 'Magnets remember', text: 'A hard magnet keeps pointing the way it was pushed, even when the field is gone. Hard disks store bits this way.' },
  'domains.kerr': { floor: 3, title: 'Light reads the magnet', text: 'Reflected light turns slightly with the magnetisation; an analyser makes that twist visible as light and dark domains.' },
  'bragg.law': { floor: 3, title: 'Bragg’s law: 2d sinθ = nλ', text: 'Waves bouncing off neighbouring planes of a crystal add up only when the extra path is a whole number of wavelengths.' },
  'bragg.missing': { floor: 3, title: 'Missing peaks tell the lattice', text: 'Extra atoms halfway between the planes cancel some reflections. Which peaks are missing reveals the crystal’s structure.' },
  'bragg.freq': { floor: 3, title: 'Shorter waves, smaller angles', text: 'Halve the wavelength and the peaks move to smaller angles. X-rays are short enough for atoms 0.3 nm apart.' },
  'rod.hammer': { floor: 3, title: 'Shaken domains follow the field', text: 'Each blow frees the pinned domains for an instant, and they settle along Earth’s field. Steel becomes a magnet just by being hit.' },
  'rod.erase': { floor: 3, title: 'Shaking with no field erases', text: 'Across the field there is no preferred way along the rod, so hammering scrambles the domains and the magnet fades.' },
  'rod.soft': { floor: 3, title: 'Soft iron forgets at once', text: 'Soft iron’s domains follow the field almost freely, so it cannot keep its poles. Permanent magnets are made of hard materials.' },
};

export function cardsOnFloor(f) { return Object.entries(CARDS).filter(([, c]) => c.floor === f).map(([id]) => id); }
