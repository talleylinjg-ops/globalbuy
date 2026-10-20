import { useMember } from '../authStore.js';

// header 会员入口：未登录 Sign in，登录显示名字（点击进会员中心）
export default function AccountMenu({ t }) {
  const session = useMember();
  const customer = session?.customer || {};
  const label = session
    ? (customer.name || customer.email || '').split(' ')[0] || t('account.myAccount')
    : t('account.signIn');
  return (
    <a href="#/account" className="header-account-link" title={session ? t('account.myAccount') : t('account.signIn')}>
      <span className="account-link-text">{label}</span>
    </a>
  );
}
