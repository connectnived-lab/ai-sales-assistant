"""E2E smoke for AI Sales Assistant: 390x844 and 1440x900. Demo flow, then live drafting against a mock endpoint."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from harness import ROOT, MOCK_MODEL, Mock, configure_live, check, check_page, new_page, run_all  # noqa: E402


def flow(browser, size, url):
    context, page, errors = new_page(browser, size)
    mock = Mock('Subject: Quick idea for Acme\n\nHi Ana,\nMOCK-LIVE-EMAIL worth a call next week?')
    mock.install(context)
    page.goto(url)
    page.wait_for_selector('#qualify-form')
    check('Demo mode' in page.inner_text('#mode-badge'), f'{size}: demo badge')

    page.fill('#q-company', 'Acme')
    page.fill('#q-role', 'Founder and CEO')
    page.fill('#q-size', '120')
    page.fill('#q-budget', '12k')
    page.fill('#q-timeline', 'asap')
    page.fill('#q-need', 'Invoices take hours each week and cash arrives late.')
    page.check('#q-engaged')
    page.click('#qualify-btn')
    page.wait_for_selector('#score-tier >> text=hot')
    check(page.inner_text('#score-value') == '100', f'{size}: hot score is 100')
    check('proposal' in page.inner_text('#next-step'), f'{size}: next step shown')

    page.fill('#e-prospect', 'Ana Rao')
    page.fill('#e-company', 'Acme')
    page.fill('#e-product', 'Ledgerly')
    page.fill('#e-pain', 'invoices pile up')
    page.fill('#e-sender', 'Nived')
    page.click('#email-btn')
    page.wait_for_selector('#email-body >> text=Hi Ana,')
    check('invoices pile up' in page.inner_text('#email-body'), f'{size}: pain point in the draft')
    page.wait_for_timeout(100)
    page.screenshot(path=str(ROOT / 'docs' / f'screenshot-{size}.png'))
    check_page(page, errors, f'{size} demo')

    configure_live(page)
    page.click('#qualify-btn')
    page.wait_for_selector('#model-note >> text=MOCK-LIVE-EMAIL')
    check(len(mock.requests) == 1, f'{size}: live qualify request sent')
    page.click('#email-btn')
    page.wait_for_selector('#email-body >> text=MOCK-LIVE-EMAIL')
    check(page.inner_text('#email-out').find('Quick idea for Acme') >= 0, f'{size}: live subject shown')
    check(len(mock.requests) == 2, f'{size}: live email request sent')
    check(mock.requests[-1]['model'] == MOCK_MODEL, f'{size}: live request used the model name')
    check_page(page, errors, f'{size} live')
    context.close()


if __name__ == '__main__':
    run_all(flow)
