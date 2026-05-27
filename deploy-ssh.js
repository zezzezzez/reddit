const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const key = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAp7ksi9K5K67DQmylX5ZNFgXmCsr6ji9JnJGJ/iwHtLlCj/Ca
b8h3OIe7ZTe2CF0bnTWAyJnOrp8UL2IPB0JAxX6dJpALN18RlzEH6CUxw7AIWI5g
qvVlIoOKuXlA6vOkK3SYBWekmExeyhgfkZg0FuCkevIbAt/vvpg0edQEMIxqIcTt
NJaPsSd6b6uXB/a6eN/RO9gx6+gwUV1oze3pvCwlU+rS1s5rAsQjeSYn86kJmDyJ
XOqd1ug+YbThp3jpVDkD6m4JdQpM7chsRibDv99cyyd9UDBzIvG6JY+fW36EDpoC
vK+4zqzWIdjIh4xVB9fS/797U13r4+t026RO7QIDAQABAoIBADv3CYUoHsoOXoM2
It4M95yDGV8MeQ4yu+e9ZQ+5oDut7K1XwW9rxawxYv9qLqvI1iGbymJuEyX9fBMA
xQy8VDoH7Zmm8EuosrpSblhCTAuBuUooBUm6GKGBVCzBvEMEPtLGib+M8Zz92Pn6
K/c66oyvXj8SpjOd6rJC6qgP9DuCtAbAse9K8YHNlnVGow0aOR/UcM9xVYLjtwJj
YlVRn2Iy02pnBDe+/m8Q6C1B4RyfeVgmA5uoPmr1xsNPcA5koz97D3Eb5qIGH5pW
HSufh+EpnnR+4Htb1lw2TGm7we7bvDS36CUWYI25o7NZ/pPa6baH/Hk1xYKwLas0
QV5k8mUCgYEA1Y2VUu7oxF6HyidtpZGjpxk9BQ2/tuxUkI8GXzAn+CwrvUMHH7Bv
nBk123V4eqAgC4M95rk49+7gjhZP7MCS24FCZSCngKw7GvPmp2gfHuUNtF8hWnAI
WRYCCRSay6RkmD6XWQcjh6KxqvYtxuaagMdvVCQK7NgfgWdFv58768cCgYEAyQ+Y
QJrpXQI+DcDF8VV9Y2++wqd06ZBfWIAoo6DPoISEMkxSDbGYHI+Dbe+H5Fe2mMLf
ix64Ce3L8zEM4W8oBvu5SMSw+xFpzEOGMflkHRLUXyRen6qVn79sFbahutSorPO5
q3qsnM+GmQSDfSgAtCWkvWJDdPFrZ3IEddO5p6sCgYAxxT+qBnhFW+q12J6bWegU
R7OK+/tUfJvw3QSVJroKAvFmuLpuTkaU0ONWdHhRzAPr6viAT2bRkeDP/K8/9FnF
wshgnU2slXdo/rMhDQlDwAqDoTA6zaWEbbanux+gmn2/ZccMPrevIuHZgGqG0rPr
k4+EwqmxLWWaWSFOWaQzfQKBgQCWmaDAW4iKy0AxywA5SYC3N59abFYNEL/qKWzH
S4/ZuwjOKA6aBTlbwz993BoctnqmJ+mLakIN5dmLWmU8gqcnu+tID1RFawClKLre
ud/8SvtaHILn871JP/e0t+yiZeHGUnTzddrPRj6aZSAcYhdM2Jlx5aWDdcWuYV/n
5eQ9KwKBgQCi6oxzYsNFwnzUXhCXQ7x8nqy4VF66ERgtIAQaTPsWaVRKFINcdoU3
8H6Xlgf1szwhOnwd1hcmZUG09eJ5r8a1TDCPnabm/1TiANwma9YmeapUOda4DAWE
3XMBc6KHJeEc2T77LXx1lhChSThk3Ic1dmKLWauHHjaOOKxnQBBg2A==
-----END RSA PRIVATE KEY-----
`;

const keyPath = path.join(__dirname, '.ssh-key.pem');
fs.writeFileSync(keyPath, key, 'utf8');
console.log('Key saved to:', keyPath);

// Set permissions
try {
  execSync(`icacls "${keyPath}" /inheritance:r /grant:r "${process.env.UserName}:(R)"`, { stdio: 'inherit' });
  console.log('Permissions set');
} catch (e) {
  console.error('Failed to set permissions:', e.message);
}

// SSH connection test
try {
  const cmd = `ssh -i "${keyPath}" -o StrictHostKeyChecking=no ec2-user@63.183.212.153 "echo SSH_SUCCESS && cd ~/reddit && git log --oneline -1 && docker ps"`;
  console.log('Executing:', cmd);
  const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
  console.log('\n=== SSH Result ===');
  console.log(result);
} catch (e) {
  console.error('SSH failed:', e.message);
  console.error('Exit code:', e.status);
}
