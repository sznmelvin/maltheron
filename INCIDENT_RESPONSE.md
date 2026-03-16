# Incident Response Guide

This guide outlines procedures for handling common incidents with Maltheron.

## Incident Levels

### Level 1: Minor
- Non-critical API endpoints slow or unavailable
- Dashboard features not working
- Single agent experiencing issues

### Level 2: Moderate
- Authentication failures
- Transaction processing failures
- Database connectivity issues

### Level 3: Critical
- Complete service outage
- Security breach
- Data loss or corruption
- Financial loss

## Response Procedures

### Service Outage

1. **Check Status**
   ```bash
   curl https://your-domain.com/v1/health
   ```

2. **Check Logs**
   ```bash
   # View recent logs
   bun run dev:backend 2>&1 | tail -100
   
   # Or check hosted platform logs (Render/Railway)
   ```

3. **Common Causes**
   - Convex deployment issue → Run `npx convex deploy`
   - Environment variables misconfigured → Check platform config
   - Base RPC issues → Check blockchain connectivity

### Authentication Failures

1. **Symptoms**
   - Users unable to sign in
   - Session errors

2. **Diagnosis**
   - Check SIWE message parsing
   - Verify nonce validation
   - Check Convex connectivity

3. **Resolution**
   - Verify nonce cleanup is running (check `convex/nonces.ts`)
   - Check session expiry settings

### Transaction Failures

1. **Symptoms**
   - Transaction recording fails
   - Fee calculation incorrect
   - Balance not updating

2. **Diagnosis**
   - Check audit logs: `GET /v1/admin/audit?action=transaction.record`
   - Verify Convex mutations are executing

3. **Resolution**
   - Check agent status (may be suspended)
   - Verify currency is USDC
   - Check amount limits

### Security Incident

1. **Immediate Actions**
   - Suspend compromised agent: `POST /v1/admin/agents/:id/suspend`
   - Review audit logs for suspicious activity
   - Check for unauthorized admin access

2. **Investigation**
   ```bash
   # Get recent audit logs
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://your-domain.com/v1/admin/audit?limit=100
   ```

3. **Recovery**
   - Remove compromised sessions
   - Reset agent credentials
   - Document incident

### Database Issues

1. **Convex Not Responding**
   ```bash
   # Test Convex connectivity
   npx convex status
   
   # Redeploy if needed
   npx convex deploy
   ```

2. **Data Corruption**
   - Contact Convex support
   - Restore from backups if available

## Escalation

| Level | Response Time | Contact |
|-------|--------------|---------|
| 1 | 24 hours | Dev team |
| 2 | 4 hours | Dev team + CTO |
| 3 | 1 hour | All hands + support |

## Post-Incident

1. Document incident timeline
2. Identify root cause
3. Implement prevention measures
4. Update runbook if needed

## Monitoring Alerts

Set up alerts for:
- Health check failures → `/v1/health` returns non-200
- High error rate → Check logs
- Unusual transaction patterns → Monitor Convex data

## Contact Information

- **Convex Support**: https://convex.dev/support
- **Base RPC Status**: https://status.base.org
