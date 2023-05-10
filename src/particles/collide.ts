import { Core } from "./core";

const { sqrt } = Math;

/**
 * \mathbf{J} = \frac{(1 + E)(\mathbf{x}_1 - \mathbf{x}_2)}{2} \frac{\langle \mathbf{v}_1 - \mathbf{v}_2, \mathbf{x}_1 - \mathbf{x}_2\rangle}{\langle \mathbf{x}_1 - \mathbf{x}_2, \mathbf{x}_1 - \mathbf{x}_2\rangle}, \\
 * S = \frac{\|\mathbf{v}_1\| + \|\mathbf{v}_2\|}{\|\mathbf{v}_1 - \mathbf{J}\| + \|\mathbf{v}_2 + \mathbf{J}\|}, \\
 * \mathbf{v}'_1 = S(\mathbf{v}_1 - \mathbf{J}), \\
 * \mathbf{v}'_2 = S(\mathbf{v}_2 + \mathbf{J})
 */
export function collideParticles(
  particles: Core["particles"],
  displacement: Core["particleDisplacementBuffer"],
  i: number,
  j: number
) {
  // Get particle radius and positions
  const r = particles.r;
  const x_1x = particles.x_x[i];
  const x_1y = particles.x_y[i];
  const x_2x = particles.x_x[j];
  const x_2y = particles.x_y[j];

  // Check if particles are colliding
  const dx_x = x_1x - x_2x;
  const dx_y = x_1y - x_2y;
  const dxDotDx = dx_x * dx_x + dx_y * dx_y;
  if (dxDotDx > (r * 2) ** 2) {
    return false;
  }

  // Calculate displacement required to remove particle overlap
  const dx_m = sqrt(dxDotDx);
  const D_s = ((r * 2 - dx_m) / dx_m) * 0.5001;
  const D_x = D_s * dx_x;
  const D_y = D_s * dx_y;

  // Store updated displacement in temporary buffer
  // It is not applied until all particle-particle collisions have been detected, to improve simulation accuracy
  displacement.D_x[i] += D_x;
  displacement.D_y[i] += D_y;
  displacement.D_x[j] -= D_x;
  displacement.D_y[j] -= D_y;

  // Get elasticity coefficient and particle velocities
  const E = particles.E;
  const v_1x = particles.v_x[i];
  const v_1y = particles.v_y[i];
  const v_2x = particles.v_x[j];
  const v_2y = particles.v_y[j];

  // Calculate the difference in velocities
  const dv_x = v_1x - v_2x;
  const dv_y = v_1y - v_2y;

  // Calculate impulse vector
  const dvDotDx = dv_x * dx_x + dv_y * dx_y;
  const J_s = ((1 + E) * dvDotDx) / (dxDotDx * 2);
  const J_x = J_s * dx_x;
  const J_y = J_s * dx_y;

  // Calculate updated velocities
  let u_1x = v_1x - J_x;
  let u_1y = v_1y - J_y;
  let u_2x = v_2x + J_x;
  let u_2y = v_2y + J_y;

  // Calculate the magnitude of the velocities
  const v1_mag = sqrt(v_1x * v_1x + v_1y * v_1y);
  const v2_mag = sqrt(v_2x * v_2x + v_2y * v_2y);
  const u1_mag = sqrt(u_1x * u_1x + u_1y * u_1y);
  const u2_mag = sqrt(u_2x * u_2x + u_2y * u_2y);

  // Calculate scaling factor
  const S = (v1_mag + v2_mag) / (u1_mag + u2_mag);

  // Finalise and store updated velocities
  particles.v_x[i] = u_1x * S;
  particles.v_y[i] = u_1y * S;
  particles.v_x[j] = u_2x * S;
  particles.v_y[j] = u_2y * S;

  return true;
}

export function collideBoundary(
  particles: Core["particles"],
  i: number,
  d: number,
  n_x: number,
  n_y: number
) {
  const vDotN = particles.v_x[i] * n_x + particles.v_y[i] * n_y;
  const D_m = -d - particles.r;
  const D_x = n_x * D_m;
  const D_y = n_y * D_m;
  particles.x_x[i] += D_x;
  particles.x_y[i] += D_y;
  if (vDotN < 0) return;
  const J_x = -vDotN * n_x * 2;
  const J_y = -vDotN * n_y * 2;
  particles.v_x[i] += J_x;
  particles.v_y[i] += J_y;
}
