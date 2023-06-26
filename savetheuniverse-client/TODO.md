- spawn / removal area
- boundary / sim presets
- glitch with one particle not moving / interacting with others
- use -1 to indicate empty cells in cell grid, to avoid ambiguity with particle at i=0
- exact number of particles seems wrong (they don't all disapear when slider dragged down to 0)

- generate boundary from image

  - figure out what is "inside" the boundary
    - the pixel color at coords 0,0 in the input image determines what color indicates the boundary
  - resample B-Spline to get segment boundaries for each cell in lookup table
  - JFA to get closest segment
  - for each cell, get 4 closest segments and merge
  - cache each unique combination of segments (lookup table to cache will be 16MB, 2048x2048, uint32)
  - search bounds of segment using golden section search to find contact point
  - aggregate contact points (min distance & average normals)
  - min of four samples
  - complete appendix visualisation
    - fix stretch on boundary SVG
    - add lines along normals to indicate curvature
  - nearest segment appendix visualisation

- numerical stability improvements

  - bisection search when colission count is low
  - adaptive time steps
  - increase dispersion force for particles with many colissions per time step (decay count)

- "island of stability" viz
- automate generation
- polar / cartesian projection of phase space
- checkpoint generation
- macrostate colour coding

- add hosting
- CICD: https://lightrains.com/blogs/deploy-aws-ec2-using-github-actions/
