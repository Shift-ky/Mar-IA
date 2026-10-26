import React from 'react';
import {createRoot} from 'react-dom/client';
import AccountForm from '../app/account-form';
import Dashboard from '../app/dashboard';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(location.pathname==='/nova-senha'?<AccountForm reset/>:<Dashboard/>);
