type Vec3 = { x: number; y: number; z: number };

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

let shared: string[] = [];

// use this to make demonstrative visualisation: https://threejs.org/examples/?q=instan#webgl_instancing_raycast
function kernel(
  gridDim: Vec3,
  blockDim: Vec3,
  blockIdx: Vec3,
  threadIdx: Vec3,
  radius: number
) {
  // Calculate thread index in global memory
  const x = blockIdx.x * blockDim.x + threadIdx.x;
  const y = blockIdx.y * blockDim.y + threadIdx.y;
  const z = blockIdx.z * blockDim.z + threadIdx.z;

  // Shared memory size
  const sharedDimX = blockDim.x + 2 * radius;
  const sharedDimY = blockDim.y + 2 * radius;
  const sharedDimZ = blockDim.z + 2 * radius;

  // Allocate shared memory
  if (!shared) {
    shared = []; // new Array(sharedDimX * sharedDimY * sharedDimZ).fill("");
  }

  // Calculate thread index in shared memory
  // const s_x = threadIdx.x + radius;
  // const s_y = threadIdx.y + radius;
  // const s_z = threadIdx.z + radius;

  function loadVoxel(gx: number, gy: number, gz: number) {
    console.log(`(${x},${y},${z}) -> (${gx},${gy},${gz})`);
    shared.push(`(${gx},${gy},${gz})`);
  }

  // 2 + 3 + 5
  // 1 + 2 + 7

  // for (let w of [
  //   [1, 0.5, 0.5],
  //   [0.5, 1, 0.5],
  //   [0.5, 0.5, 1],
  // ]) {
  //   const [w1, w2, w3] = w;
  //   console.log(
  //     1 +
  //       w1 * 2 +
  //       w2 * 2 +
  //       w2 * w1 * 4 +
  //       w3 * 2 +
  //       w3 * w1 * 2 +
  //       w3 * w2 * 4 +
  //       w3 * w2 * w1 * 8
  //   );
  // }
  // 1 + w1*2 + w2*2 + w2*w1*4 + w3*2 + w3*w1*2 + w3*w2*4 + w3*w2*w1*8
  // what permutation of real numbers x,y,z will minimise function f(x,y,z) y + 2z + yz?:

  // 1 + 2x + 2y + 2z + 4xy + 4xz + 4yz + 8xyz
  // x < y < z
  // x < z < y
  // y < z < x
  // y < x < z
  // z < x < y
  // z < y < x

  loadVoxels: {
    loadVoxel(x, y, z);
    if (threadIdx.x < radius) {
      loadVoxel(x - radius, y, z);
      loadVoxel(x + blockDim.x, y, z);
    }
    if (threadIdx.y < radius) {
      loadVoxel(x, y - radius, z);
      loadVoxel(x, y + blockDim.y, z);
      if (threadIdx.x < radius) {
        loadVoxel(x - radius, y - radius, z);
        loadVoxel(x - radius, y + blockDim.y, z);
        loadVoxel(x + blockDim.x, y - radius, z);
        loadVoxel(x + blockDim.x, y + blockDim.y, z);
      }
    }
    if (threadIdx.z < radius) {
      loadVoxel(x, y, z - radius);
      loadVoxel(x, y, z + blockDim.z);
      if (threadIdx.x < radius) {
        loadVoxel(x - radius, y, z - radius);
        loadVoxel(x - radius, y, z + blockDim.z);
        loadVoxel(x + blockDim.x, y, z - radius);
        loadVoxel(x + blockDim.x, y, z + blockDim.z);
      }
      if (threadIdx.y < radius) {
        loadVoxel(x, y - radius, z - radius);
        loadVoxel(x, y - radius, z + blockDim.z);
        loadVoxel(x, y + blockDim.y, z - radius);
        loadVoxel(x, y + blockDim.y, z + blockDim.z);
        if (threadIdx.x < radius) {
          loadVoxel(x - radius, y - radius, z - radius);
          loadVoxel(x - radius, y - radius, z + blockDim.z);
          loadVoxel(x - radius, y + blockDim.y, z - radius);
          loadVoxel(x - radius, y + blockDim.y, z + blockDim.z);
          loadVoxel(x + blockDim.x, y - radius, z - radius);
          loadVoxel(x + blockDim.x, y - radius, z + blockDim.z);
          loadVoxel(x + blockDim.x, y + blockDim.y, z - radius);
          loadVoxel(x + blockDim.x, y + blockDim.y, z + blockDim.z);
        }
      }
    }
  }

  // loadVoxels: {
  //   /**
  //    *
  //    **/
  //   loadVoxel(x, y, z);
  //   if (threadIdx.z < radius) {
  //     loadVoxel(x, y, z - radius);
  //     if (threadIdx.y < radius) {
  //       loadVoxel(x, y - radius, z - radius);
  //       if (threadIdx.x < radius) {
  //         loadVoxel(x - radius, y - radius, z - radius);
  //         loadVoxel(x + blockDim.x, y - radius, z - radius);
  //       }
  //     }
  //     if (threadIdx.y >= blockDim.y - radius) {
  //       loadVoxel(x, y + radius, z - radius);
  //       if (threadIdx.x < radius) {
  //         loadVoxel(x - radius, y + radius, z - radius);
  //         loadVoxel(x + blockDim.x, y + radius, z - radius);
  //       }
  //     }
  //     if (threadIdx.x < radius) {
  //       loadVoxel(x - radius, y, z - radius);
  //       loadVoxel(x + blockDim.x, y, z - radius);
  //     }
  //   }
  //   if (threadIdx.z >= blockDim.z - radius) {
  //     loadVoxel(x, y, z + radius);
  //     if (threadIdx.y < radius) {
  //       loadVoxel(x, y - radius, z + radius);
  //       if (threadIdx.x < radius) {
  //         loadVoxel(x - radius, y - radius, z + radius);
  //         loadVoxel(x + blockDim.x, y - radius, z + radius);
  //       }
  //     }
  //     if (threadIdx.y >= blockDim.y - radius) {
  //       loadVoxel(x, y + radius, z + radius);
  //       if (threadIdx.x < radius) {
  //         loadVoxel(x - radius, y + radius, z + radius);
  //         loadVoxel(x + blockDim.x, y + radius, z + radius);
  //       }
  //     }
  //     if (threadIdx.x < radius) {
  //       loadVoxel(x - radius, y, z + radius);
  //       loadVoxel(x + blockDim.x, y, z + radius);
  //     }
  //   }
  //   if (threadIdx.y < radius) {
  //     loadVoxel(x, y - radius, z);
  //     if (threadIdx.x < radius) {
  //       loadVoxel(x - radius, y - radius, z);
  //       loadVoxel(x + blockDim.x, y - radius, z);
  //     }
  //   }
  //   if (threadIdx.y >= blockDim.y - radius) {
  //     loadVoxel(x, y + radius, z);
  //     if (threadIdx.x < radius) {
  //       loadVoxel(x - radius, y + radius, z);
  //       loadVoxel(x + blockDim.x, y + radius, z);
  //     }
  //   }
  //   if (threadIdx.x < radius) {
  //     loadVoxel(x - radius, y, z);
  //     loadVoxel(x + blockDim.x, y, z);
  //   }
  // }
}

for (let x = 0; x < 8; x++) {
  for (let y = 0; y < 8; y++) {
    for (let z = 0; z < 8; z++) {
      kernel(vec3(32, 32, 32), vec3(8, 8, 8), vec3(1, 1, 1), vec3(x, y, z), 4);
    }
  }
}

const sharedSet = new Set(shared);

console.log(shared.length);
console.log(Array.from(sharedSet).length);

// for (let x = 0; x < 9; x++) {
//   for (let y = 0; y < 9; y++) {
//     for (let z = 0; z < 9; z++) {
//       if (!sharedSet.has(`(${x},${y},${z})`)) {
//         console.log(`${x},${y},${z}`);
//       }
//     }
//   }
// }
