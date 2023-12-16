- standalone particle toy
- particle trails
- adaptive step size to improve numeric stability (using bisection search)

---

lower priority

- spawn / removal area
- boundary / sim presets
- glitch with one particle not moving / interacting with others
- use -1 to indicate empty cells in cell grid, to avoid ambiguity with particle at i=0
- standalone version
- generate boundary from image
  - try a few billiards
  - create a library
  - tune performance of lookups
  - make sure not in contact after collision
  - complete appendix visualisation
    - indicate normals
    - fixed distance toggle
    - indicate area searched
- scale viz to fit canvas
- tune dispersion forces

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
