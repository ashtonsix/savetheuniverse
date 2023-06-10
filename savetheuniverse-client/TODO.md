- spawn area
- boundary / sim presets
- glitch with one particle not moving / interacting with others
- use -1 to indicate empty cells in cell grid, to avoid ambiguity with particle at i=0
- abandon constructive structural geometry in favour of generating sdf from function or image
- exact number of particles seems wrong (they don't all disapear when slider dragged down to 0)
- adaptive time steps

- generate SDF from image
  - image upload
  - find edges
  - smooth vertices
  - JFA to get closest
  - extract polylines
  - bezier curves
  - min of four samples
- use WebGL to accelerate drawing boundary
- use WebGL to accelerate generation from image

- "island of stability" viz

- add hosting
- CICD: https://lightrains.com/blogs/deploy-aws-ec2-using-github-actions/
