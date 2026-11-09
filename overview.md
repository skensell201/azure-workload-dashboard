# Workload Dashboard

Shows specialist workload across **all projects of the collection** in one matrix:
rows are people, columns are projects, each cell is `Original Estimate / Completed Work`
hours from Tasks assigned to the person in iterations intersecting the selected
date window (default: the current two weeks). A row expands into the person's task list.

Each viewer sees only the projects they have access to.

A project column reads `Original Estimate / Completed Work` hours for the tasks
planned there, `no tasks` for someone who is in that project's team but was not
planned on the sprint, and `—` for someone outside the project — so a manager
can scan one column to see who was left off the sprint.

The Excel export keeps the hours numeric and carries the same information
beside them: a `Projects without tasks` column and a `No tasks` sheet listing
every person and project they were left unplanned in.
