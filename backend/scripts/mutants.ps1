# mutants.ps1
# User owns mutants.ps1
# If empty, mutation.ps1 prints "no mutants" and exits 1.
$r = 'backend\src\routes\paymentRoutes.js'
Test-Mutation $r 'AND status != ''PAID'' RETURNING *' 'AND 1=1 RETURNING *'
Test-Mutation $r 'if (updateRes.rowCount > 0) {' 'if (true) {'
Test-Mutation $r "'/admin/sessions/:id/mark-paid', authenticate, requireSuperAdmin," "'/admin/sessions/:id/mark-paid', authenticate,"
Test-Mutation $r 'if (!reason || !String(reason).trim()) {' 'if (false) {'
Test-Mutation $r 'COALESCE(GREATEST(plan_expires_at, NOW()), NOW())' 'NOW()'
Test-Mutation $r 'months <= 0 ||' 'false ||'
