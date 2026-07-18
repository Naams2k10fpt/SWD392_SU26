# Copy this file to local-env.ps1 and replace the placeholder values.
# local-env.ps1 is ignored by Git and must never be committed.

$env:LUCY_DB = "Server=localhost;Database=lucy_phase5;User=root;Password=CHANGE_ME;AllowUserVariables=True;"
$env:LUCY_JWT_SECRET = "CHANGE_ME_TO_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
$env:LUCY_DB_URL = "mysql://root:CHANGE_ME@localhost:3306/lucy_phase5"
$env:LUCY_JDBC_URL = "jdbc:mysql://localhost:3306/lucy_phase5"
$env:LUCY_DB_USER = "root"
$env:LUCY_DB_PASSWORD = "CHANGE_ME"
